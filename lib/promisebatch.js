

function PromiseBatch() {
	var queue = [];
	var results = [];
	var concurrencyLimit = 4;
	var running = 0;
	var resolveAll;
	var finished = false;

	this.promise = new Promise(function(rs) {
		resolveAll = rs;
	});

	function next() {
		var task;
		while (queue.length && running < concurrencyLimit) {
			task = queue.shift();
			running++;
			task.taskFn().then(function(result) {
				task.resolve(result);
				results.push(result);
				running--;
				next();
			}, function(err) {
				console.warn("TASK REJECTED", err.stack || err);
				task.reject(err);
				running--;
				next();
			});
		}
		if (!queue.length && !running) {
			resolveAll();
			finished = true;
		}
	}

	this.setConcurrency = function(max) {
		concurrencyLimit = max;
	}

	this.push = function(taskFn) {
		var task = {taskFn: taskFn};
		if (finished) throw new Error('Batch has already settled');
		if (typeof taskFn !== 'function') throw new TypeError('PromiseBatch task was not a function');
		prom = new Promise(function(rs, rj) {
			task.resolve = rs;
			task.reject = rj;
		});
		console.log('Adding task');
		queue.push(task);
		return prom;
	}

	this.run = function() {
		next();
		return this.promise;
	}
}

module.exports = PromiseBatch;



