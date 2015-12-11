require('dotenv').load({silent: true});

const path = require('path');
const express = require('express');
const exphbs = require('express-handlebars');
const ftwebservice = require('express-ftwebservice');
const source = require('./lib/data');

const app = express();

const hbs = exphbs.create({
    helpers: {
        ifEq: function (a, b, opts) { return (a === b) ? opts.fn(this) : opts.inverse(this); },
        ifNot: function (a, opts) { return (!a) ? opts.fn(this) : opts.inverse(this); },
        ifRange: function (val, low, high, opts) { return (val >= low && val < high) ? opts.fn(this) : opts.inverse(this); }
    }
});
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

ftwebservice(app, {
	manifestPath: path.join(__dirname, '/package.json'),
	about: require('./about.json')
});

app.use("/static", express.static(__dirname + '/public'));

app.get('/services', function (req, res) {
	res.render('services', source.getServices());
});

app.get('/modules', function (req, res) {
	res.render('modules', source.getModules());
});

const server = app.listen(process.env.PORT || 3002, function () {
	console.log('Listening at http://%s:%s', server.address().address, server.address().port);
});
