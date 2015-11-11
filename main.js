require('dotenv').load();

var express = require('express');
var exphbs = require('express-handlebars');
var request = require('request-promise');
var app = express();
var config = require('./config.json');

var data = [];
var periodSecs = 86400 * config.timeRangeDays;

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
	data = [];
	Promise.all(Object.keys(config.services).map(function(serviceName) {
		var newdata = {};
		return Promise.all([
			pingdomRequest('summary.average/' + config.services[serviceName].pingdomCheck + '?from=' + sevenDaysAgo + '&includeuptime=true')
			.then(function(respdata) {
				newdata.respTime = respdata.summary.responsetime.avgresponse;
				newdata.totalDowntime = respdata.summary.status.totaldown;

			}),
			pingdomRequest('checks/' + config.services[serviceName].pingdomCheck)
			.then(function(respdata) {
				newdata.up = (respdata.check.status === 'up');
				newdata.lastErrorTime = respdata.check.lasterrortime;

			}),
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
			})
		]).then(function() {
			newdata.serviceName = serviceName;
			data.push(newdata);
		});
	}))
	.then(function() {
		//console.log('Refreshed', data);
	})
	.catch(function(err) {
		console.log(err.stack || err);
	});
}

setInterval(refresh, config.refreshInterval);
refresh();

app.get('/', function (req, res) {
	res.render('services', {services:data});
});

var server = app.listen(3002, function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log('Listening at http://%s:%s', host, port);
});
