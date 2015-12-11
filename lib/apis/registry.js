var request = require('request-promise');

const endpoint = process.env.ENDPOINT_REGISTRY || "http://registry.origami.ft.com";

const apiReq = function(path) {
	return request(endpoint+path)
		.then(function(response) {
			return JSON.parse(response);
		})
	;
}

module.exports = {
	listModules: function() {
		return apiReq('/packages')
			.then(function(list) {
				return list.map(function(module) {
					const urlparts = module.url.match(/github.com\/([^\/]+)\/([^\/\.]+)/);
					return {
						name: module.name,
						org: urlparts[1],
						repo: urlparts[2]
					};
				});
			})
		;
	},
	getModuleDetails: function(moduleName) {
		return apiReq('/components/'+moduleName+'.json')
			.then(function(resp) {
				return {
					dateReleased: resp.latest_datetime_created.date,
					supportStatus: resp.support_status,
					isValid: !!resp.is_valid,
					outOfDateDepCount: resp.dependencies.reduce(function(count, dep) {
						if (!dep.uptodate) count++;
						return count;
					}, 0)
				}
			})
			.catch(function(err) { console.log(err.stack || err); })
		;
	}
};
