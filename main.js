require('dotenv').load({silent: true});

var path = require('path');
var express = require('express');
var exphbs = require('express-handlebars');
var request = require('request-promise');
var ftwebservice = require('express-ftwebservice');
var PromiseBatch = require('./lib/promisebatch');
var apis = {
	registry: require('./lib/apis/registry'),
	pingdom: require('./lib/apis/pingdom'),
	github: require('./lib/apis/github'),
	health: require('./lib/apis/health'),
	sentry: require('./lib/apis/sentry')
};
var config = require('./config.json');

var app = express();

var data = {services:[], modules:[]};
var periodSecs = 86400 * config.timeRangeDays;

apis.github.setPeriod(periodSecs);

data.modulesUpdatedCount = 3;
data.countributorsCount = 6;
data.issuesOpenedCount = 4;
data.issuesClosedCount = 7;


var hbs = exphbs.create({
    helpers: {
        ifEq: function (a, b, opts) { return (a == b) ? opts.fn(this) : opts.inverse(this); },
        ifNot: function (a, opts) { return (!a) ? opts.fn(this) : opts.inverse(this); },
        ifRange: function (val, low, high, opts) { return (val >= low && val < high) ? opts.fn(this) : opts.inverse(this); }
    }
});
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');


function refresh() {
	var startTime = Math.floor(Date.now()/1000) - periodSecs;
	var newModuleData = {};
	var newServicesData = {};

	var batch = new PromiseBatch();
	batch.setConcurrency(4);

	Object.keys(config.services).forEach(function(serviceName) {
		var svc = config.services[serviceName];
		if (svc.pingdomCheck) {
			batch.push(apis.pingdom.getHistory.bind(null, svc.pingdomCheck, startTime)).then(function(res) {
				newServicesData[serviceName] = Object.assign({}, newServicesData[serviceName], res);
			});
			batch.push(apis.pingdom.getCurrentStatus.bind(null, svc.pingdomCheck)).then(function(res) {
				newServicesData[serviceName] = Object.assign({}, newServicesData[serviceName], res);
			});
		}
		if (svc.healthUrl) {
			batch.push(apis.health.getOverallSeverity.bind(null, svc.healthUrl)).then(function(res) {
				newServicesData[serviceName].health = res;
			});
		}
		if (svc.sentryProject) {
			batch.push(apis.sentry.getUnresolvedErrorCount.bind(null, 'nextftcom', svc.sentryProject)).then(function(res) {
				newServicesData[serviceName].errorCount = res;
			});
		}
	});

	batch.push(apis.registry.listModules).then(function(modules) {
		modules.forEach(function(mod) {
			batch.push(apis.registry.getModuleDetails.bind(null, mod.name)).then(function(res) {
				newModuleData[mod.name] = Object.assign({}, newModuleData[mod.name], res);
			});
			batch.push(apis.github.getEventStats.bind(null, mod.org, mod.repo)).then(function(res) {
				newModuleData[mod.name] = Object.assign({}, newModuleData[mod.name], res);
			});
		});
	});

	batch.run().then(function() {
		data.modules = Object.keys(newModuleData)
			.map(function(moduleName) {
				return newModuleData[moduleName];
			}).sort(function(modA, modB) {
				var a = (modA.recentCommitCount || 0) + (modA.issuesClosedCount || 0) + (modA.issuesOpenedCount || 0);
				var b = (modB.recentCommitCount || 0) + (modB.issuesClosedCount || 0) + (modB.issuesOpenedCount || 0);
				return a > b ? -1 : 1;
			}).slice(0, 10);
		;
		data.services = Object.keys(newServicesData)
			.map(function(serviceName) {
				return Object.assign({serviceName: serviceName}, newServicesData[serviceName]);
			})
		;
		console.log('New data', data);
	});
}


setInterval(refresh, config.refreshInterval);
refresh();

ftwebservice(app, {
	manifestPath: path.join(__dirname, '/package.json'),
	about: require('./about.json')
});


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
