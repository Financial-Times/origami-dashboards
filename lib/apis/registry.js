'use strict';

const request = require('request-promise');

const endpoint = process.env.ENDPOINT_REGISTRY || "http://registry.origami.ft.com";

const apiReq = function(path) {
	return request(endpoint+path)
		.then(response => JSON.parse(response))
	;
}

module.exports = {
	listModules() {
		return apiReq('/packages')
			.then(list => {
				return list.map(module => {
					const urlparts = module.url.match(/github.com\/([^\/]+)\/([^\/\.]+)/);
					return {
						name: module.name,
						org: urlparts[1],
						repo: urlparts[2]
					};
				});
			}).catch(() => ({
				name: module.name,
				org: null,
				repo: null
			}))
		;
	},
	getModuleDetails(moduleName) {
		return apiReq('/components/'+moduleName+'.json')
			.then(resp => ({
				dateReleased: resp.latest_datetime_created.date,
				supportStatus: resp.support_status,
				isValid: !!resp.is_valid,
				outOfDateDepCount: resp.dependencies.reduce((count, dep) => {
					if (!dep.uptodate) count++;
					return count;
				}, 0)
			}))
			.catch(() =>({
				dateReleased: null,
				supportStatus: null,
				isValid: false,
				outOfDateDepCount: null
			}))
		;
	}
};
