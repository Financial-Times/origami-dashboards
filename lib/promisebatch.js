
function PromiseBatch() {
	const queue = [];
	const results = {};
	let concurrencyLimit = 4;
	let running = 0;
	let resolveAll;
	let finished = false;
	let closed = false;
	let currentIdx = -1;

	function next() {
		while (currentIdx < queue.length && running < concurrencyLimit) {
			currentIdx++;
			executeTask(currentIdx);
		}
		if (!queue.length && !running && closed) {
			resolveAll();
			finished = true;
		}
	}

	function executeTask(idx) {
		running++;
		queue[idx]().then(function(result) {
			results[idx] = result;
			running--;
			next();
		}, function(err) {
			console.warn("TASK REJECTED", err.stack || err);
			running--;
			next();
		});
	}

	this.setConcurrency = function(max) {
		concurrencyLimit = max;
	};

	this.push = function(taskFn) {
		if (closed) throw new Error('Cannot add a task: batch is closed');
		if (finished) throw new Error('Cannot add a task: batch has already settled');
		if (typeof taskFn !== 'function') throw new TypeError('PromiseBatch task was not a function');
		queue.push(taskFn);
	};

	this.run = function() {
		next();
		return this.promise;
	};

	this.close = function() {
		closed = true;
		next();
	};

	this.promise = new Promise(function(rs) {
		resolveAll = rs;
	});
}

module.exports = PromiseBatch;
