require('dotenv').load({silent: true});

var express = require('express');
var exphbs = require('express-handlebars');
var request = require('request-promise');
var app = express();
var config = require('./config.json');

var data = {services:[]};
var periodSecs = 86400 * config.timeRangeDays;

data.modulesUpdatedCount = 3;
data.countributorsCount = 6;
data.issuesOpenedCount = 4;
data.issuesClosedCount = 7;
data.modules = [
	{moduleName:'o-grid', builds:true, outOfDateDepCount:3, supportStatus:'active', issuesOpenedCount:2, issuesClosedCount:0, commitsCount:14},
	{moduleName:'o-share', builds:false, outOfDateDepCount:0, supportStatus:'active', issuesOpenedCount:2, issuesClosedCount:0, commitsCount:14},
	{moduleName:'o-comments', builds:true, outOfDateDepCount:0, supportStatus:'maintained', issuesOpenedCount:0, issuesClosedCount:3, commitsCount:142},
	{moduleName:'o-chat', builds:true, outOfDateDepCount:0, supportStatus:'deprecated', issuesOpenedCount:1, issuesClosedCount:3, commitsCount:1},
	{moduleName:'o-grid', builds:true, outOfDateDepCount:3, supportStatus:'active', issuesOpenedCount:2, issuesClosedCount:0, commitsCount:14},
	{moduleName:'o-share', builds:false, outOfDateDepCount:0, supportStatus:'active', issuesOpenedCount:2, issuesClosedCount:0, commitsCount:14},
	{moduleName:'o-comments', builds:true, outOfDateDepCount:0, supportStatus:'maintained', issuesOpenedCount:0, issuesClosedCount:3, commitsCount:142},
	{moduleName:'o-chat', builds:true, outOfDateDepCount:0, supportStatus:'deprecated', issuesOpenedCount:1, issuesClosedCount:3, commitsCount:1},
];

var hbs = exphbs.create({
    helpers: {
        ifEq: function (a, b, opts) { return (a == b) ? opts.fn(this) : opts.inverse(this); },
        ifNot: function (a, opts) { return (!a) ? opts.fn(this) : opts.inverse(this); },
        ifRange: function (val, low, high, opts) { return (val >= low && val < high) ? opts.fn(this) : opts.inverse(this); }
    }
});
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

var pingdomRequest = function(path, opts) {
	opts = opts || {};
	return request(Object.assign({
		url: 'https://api.pingdom.com/api/2.0/'+path,
		headers: { 'app-key': process.env.PINGDOM_APIKEY, 'Account-Email': process.env.PINGDOM_ACCOUNT },
		auth: { user: process.env.PINGDOM_USERNAME, pass: process.env.PINGDOM_PASSWORD }
	}, opts))
	.then(function(response) {
		return JSON.parse(response);
	});
}

function refresh() {
	var sevenDaysAgo = Math.floor(Date.now()/1000) - periodSecs;
	Promise.all(Object.keys(config.services).map(function(serviceName) {
		var newdata = {};
		return Promise.all([
			!config.services[serviceName].pingdomCheck ? Promise.resolve() :
			pingdomRequest('summary.average/' + config.services[serviceName].pingdomCheck + '?from=' + sevenDaysAgo + '&includeuptime=true')
			.then(function(respdata) {
				newdata.respTime = respdata.summary.responsetime.avgresponse;
				newdata.totalDowntime = respdata.summary.status.totaldown;
			}),
			!config.services[serviceName].pingdomCheck ? Promise.resolve() :
			pingdomRequest('checks/' + config.services[serviceName].pingdomCheck)
			.then(function(respdata) {
				newdata.up = (respdata.check.status === 'up');
				newdata.lastErrorTime = respdata.check.lasterrortime;
			}),
			!config.services[serviceName].healthUrl ? Promise.resolve() :
			request(config.services[serviceName].healthUrl)
			.then(function(resp) {
				var respdata = JSON.parse(resp);
				if (respdata.checks) {
					newdata.health = respdata.checks.reduce(function(out, check) {
						if (!check.ok && check.severity < out) {
							out = check.severity;
						}
						return out;
					}, 4)
				} else {
					newdata.health = 'blank';
				}
			}),
			!config.services[serviceName].sentryProject ? Promise.resolve() :
			request({
				url: 'https://app.getsentry.com/api/0/projects/nextftcom/' + config.services[serviceName].sentryProject + '/?include=stats',
				auth: { user: process.env.SENTRY_APIKEY, pass: '' }
			})
			.then(function(resp) {
				var respdata = JSON.parse(resp);
				newdata.errorCount = respdata.stats.unresolved;
			})
		]).then(function() {
			newdata.serviceName = serviceName;
			return newdata;
		});
	}))
	.then(function(allServicesData) {
		data.services = allServicesData;
	})
	.catch(function(err) {
		console.log(err.stack || err);
	});
}

setInterval(refresh, config.refreshInterval);
refresh();

app.use("/static", express.static(__dirname + '/public'));

app.get('/services', function (req, res) {
	res.render('services', data);
});
app.get('/modules', function (req, res) {
	res.render('modules', data);
});

var server = app.listen(process.env.PORT || 3002, function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log('Listening at http://%s:%s', host, port);
});
