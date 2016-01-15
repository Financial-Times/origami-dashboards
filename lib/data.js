const directly = require('directly');
const apis = {
	registry: require('./apis/registry'),
	pingdom: require('./apis/pingdom'),
	github: require('./apis/github'),
	health: require('./apis/health'),
	sentry: require('./apis/sentry')
};
const config = require('../config.json');

const data = {
	services: {},
	modules: {},
	modulesUpdatedCount: 0,
	contributorsCount: 0,
	issuesOpenedCount: 0,
	issuesClosedCount: 0,
	issuesCount: 0
};
const periodSecs = 86400 * config.timeRangeDays;
const maxConcurrency = config.maxConcurrency || 4;
const refreshInterval = (config.refreshInterval || 60) * 1000;

apis.github.setPeriod(periodSecs);

function refresh() {
	const startTime = Math.floor(Date.now()/1000) - periodSecs;
	const batch = [];
	const rollups = {
		modulesUpdated: new Set(),
		contributors: new Set(),
		issuesOpenedCount: 0,
		issuesClosedCount: 0,
		issuesCount: 0
	}

	Object.keys(config.services).forEach(serviceName => {
		const cfg = config.services[serviceName];
		data.services[serviceName] = data.services[serviceName] || {name:serviceName};
		if (cfg.pingdomCheck) {
			batch.push(() => {
				return apis.pingdom.getHistory(cfg.pingdomCheck, startTime).then(res => {
					Object.assign(data.services[serviceName], res);
				});
			});
			batch.push(() => {
				return apis.pingdom.getCurrentStatus(cfg.pingdomCheck).then(res => {
					Object.assign(data.services[serviceName], res);
				});
			});
		}
		if (cfg.healthUrl) {
			batch.push(() => {
				return apis.health.getOverallSeverity(cfg.healthUrl).then(res => {
					data.services[serviceName].health = res;
				});
			});
		}
		if (cfg.sentryProject) {
			batch.push(() => {
				return apis.sentry.getUnresolvedErrorCount('nextftcom', cfg.sentryProject).then(res => {
					data.services[serviceName].errorCount = res;
				});
			});
		}
	});

	apis.registry.listModules().then(modules => {
		modules.forEach(mod => {
			data.modules[mod.name] = data.modules[mod.name] || {name:mod.name};
			batch.push(() => {
				return apis.registry.getModuleDetails(mod.name).then(res => {
					Object.assign(data.modules[mod.name], res);
				});
			});
			batch.push(() => {
				return apis.github.getEventStats(mod.org, mod.repo).then(res => {
					Object.assign(data.modules[mod.name], res);
					rollups.issuesOpenedCount += res.issuesOpenedCount;
					rollups.issuesClosedCount += res.issuesClosedCount;
					rollups.contributors = new Set([...rollups.contributors, ...res.contributors]);
					if (res.repoEventsCount > 0) rollups.modulesUpdated.add(mod.name);
				});
			});
			batch.push(() => {
				return apis.github.getIssueCount(mod.org, mod.repo).then(count => {
					rollups.issuesCount += count;
				});
			});
		});

		directly(maxConcurrency, batch)
			.then(() => {
				data.modulesUpdatedCount = rollups.modulesUpdated.size;
				data.contributorsCount = rollups.contributors.size;
				data.issuesOpenedCount = rollups.issuesOpenedCount;
				data.issuesClosedCount = rollups.issuesClosedCount;
				data.issuesCount = rollups.issuesCount;
				console.log('Update complete');
			})
			.catch(err => {
				console.log(err.stack || err);
			})
		;
	});

}

setInterval(refresh, refreshInterval);
refresh();

module.exports = {
	getServices: () => ({
		services: Object.keys(data.services).map(serviceName => data.services[serviceName])
	}),
	getModules: () => ({
		modulesUpdatedCount: data.modulesUpdatedCount,
		contributorsCount: data.contributorsCount,
		issuesOpenedCount: data.issuesOpenedCount,
		issuesClosedCount: data.issuesClosedCount,
		issuesCount: data.issuesCount,
		modules: Object.keys(data.modules)
			.map(moduleName => data.modules[moduleName])
			.sort((modA, modB) => (modA.repoEventsCount || 0) > (modB.repoEventsCount || 0) ? -1 : 1)
			.slice(0, 10)
	})
};
