/*
	<file:js>
		<src>dist/js/core.js</src>
	</file:js>
*/
(function ( root, factory ) {

	//
	// AMD support
	// ---------------------------------------------------
	if ( typeof define === 'function' && define.amd ) {

		define( [ 'jquery' ], function ( $ ) {
			// assign to root in case there are global non-amd scripts on the page,
			// which use Mk
			return (root.Mk = factory( root, $ ));
		});
	}

	//
	// CommonJS module support
	// -----------------------------------------------------
	else if ( typeof module === 'object' && module.exports ) {

		module.exports = root.document ?

			factory( root, require( 'jquery' ) ) :

			function( w ) {
				if ( !w.document ) {
					throw new Error( "Mk requires a window with a document" );
				}
				return factory( w, require( 'jquery' ) );
			};
	}

	//
	// Everybody else
	// -----------------------------------------------------
	else {

		root.Mk = factory( root, root.jQuery );
	}

})( typeof window !== "undefined" ? window : this, function (root, $) {

	//
	// version of mk core
	//
	var version = 'v1.0.0';

	//
	// check for array-like objects -
	// array, NodeList, jQuery (anything with an iterator)
	//

	function arraylike (a) {

		var l = !!a && typeof a.length == 'number'
			&& 'length' in a
			&& a.length;

		if (typeof a === 'function' || a === root) {
			return false;
		}

		return a instanceof Array
			|| a instanceof NodeList
			|| l === 0
			|| typeof l === 'number' && l > 0 && (l - 1) in a;
	}

	// test for object primitives vs.
	// instantiated objects and prototypes
	//

	function basicObj (o) {

		if (!o || o.toString().toLowerCase() !== "[object object]" ) {
			return false;
		}

		var p = Object.getPrototypeOf(o),
			c = p.hasOwnProperty('constructor') && p.constructor,
			f = ({}).hasOwnProperty.toString,
			s = f.call(Object);

		if (!p) {
			return true;
		}

		return typeof c === 'function' && f.call(c) === s;
	}

	// check for vanulla functions
	// vanilla functions have no keys and no prototype keys
	//

	function basicFunction (fn) {

		if (typeof fn !== 'function') {
			return false;
		}

		var keys = Object.keys(fn)
			.concat(Object.keys(fn.prototype));

		return keys.length < 1;
	}

	// generates unique ids
	//

	function uid () {
		return 'xxxx-4xxx-yxxx'.replace( /[xy]/g, function(c) {
			var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3 | 0x8);
			return v.toString(16);
		});
	}

	// deep copy objects to remove pointers
	//

	function copy(o) {

		var i, l ,r;

		if (o instanceof Array) {

			i = 0;
			l = o.length;
			r = [];

			for(; i < l && r.push(copy(o[i])); i++ ) {}
		}

		else if (basicObj(o)) {

			r = {};

			for(i in o) {
				r[i] = copy(o[i]);
				l = true;
			}
		}

		return r || o;
	}

	// loop arraylike objects, primities,
	// and object instances over a callback function
	//

	function each (ctx, obj, fn) {

		var i = 0, l, r;

		if (arraylike(obj)) {

			l = obj.length;

			for (; i < l && (r = fn.call(ctx, i, obj[i]) !== false); i++) {
				if (r === -1) {
					obj.splice(i, 1);
					i--; l--;
				}
			}
		}
		else {
			for (i in obj) {
				if (fn.call(ctx, i, obj[i]) === false) { break; }
			}
		}
		return ctx;
	}

	//
	// transition
	//
	// Give us our browser transition key if
	// transitions are enabled
	// --------------------------------------------------

	function transition() {

		if (transition.enabled) {

			if (transition.key) {
				return transition.key;
			}

			var el = document.createElement('xanimate'), t;

			for (t in transition.keys) {
				if (typeof el.style[t] !== 'undefined') {
					return transition.key = transition.keys[t];
				}
			}
		}
		return null;
	}

	transition.enabled = false;

	transition.key = null;

	transition.keys = {
		'transition': 'transitionend',
		'OTransition': 'oTransitionEnd',
		'MozTransition': 'transitionend',
		'WebkitTransition': 'webkitTransitionEnd'
	};

	// property
	//
	// ES5 defineProperty, propertyDescriptor, etc. to allow getters,
	// setters, and hyjack vanilla functions to take advantage of super() -
	// a dynamic method allowing super object references.
	// -------------------------------------------------------------

	function property (obj, proto, member) {

		var desc = Object.getOwnPropertyDescriptor(proto, member),
			prop, fn;

		if (typeof desc.get !== 'undefined') {
			return Object.defineProperty(obj, member, desc);
		}

		prop = proto[member];

		if (!basicFunction(prop)) {
			return obj[member] = copy(prop);
		}

		fn = wrapFunction(prop, member);

		Object.defineProperty(obj, member, {

			get: function () {
				return fn;
			},

			set: function (value) {

				var v = value;

				if (basicFunction(value)) {
					v = wrapFunction(value);
				}

				fn = v;
			}
		});
	}

	//
	// wrap vanilla functions to allow super() cabability
	//

	function wrapFunction (fn, m) {

		if (fn._id_) {
			return fn;
		}

		var func = function () {

			this._pushsuper_(m);

			var r = fn.apply(this, arguments);

			this._popsuper_(m);

			return r;
		};

		func._id_ = uid();

		func.toString = function () {
			return fn.toString();
		};

		return func;
	}

	//
	// keeps track of call stacks
	// which allows super() to be called properly
	// with nested functions (functions calling other functions calling super)
	//

	function pushsuper (m) {

		var ch = this._chain_ = this._chain_ || [],
			st = this._stack_ = this._stack_ || [],
			i  = ch.lastIndexOf(m),
			s  = this._super_,
			p  = s && s.prototype || {},
			f  = this[m];

		if (i > -1) {
			s = st[i].super.prototype._super_ || null;
			p = s && s.prototype || {};
		}

		while (s !== null
			&& p.hasOwnProperty(m)
			&& p[m]._id_ === f._id_) {

			s = p._super_ || null;
			p = s && s.prototype || {};
		}

		st.push({method: m, super: s});
		ch.push(m);
	}

	//
	// pop functions out of the call stack
	// to keep super() context in place
	//

	function popsuper (m) {

		var ch = this._chain_ = this._chain_ || [],
			st = this._stack_ = this._stack_ || [],
			i  = ch.lastIndexOf(m);

		if (i > -1) {

			ch.splice(i, 1);
			st.splice(i, 1);
		}
	}

	//
	// Template Engine
	// lightweight template system
	//
	// features:
	//
	// data - {{<datapoint>}}
	// inject data points by (key) datapoint name.
	//
	// highlight - {{highlight:<datapoint>}}
	// inject identifying markup around a selected portion of matched text.
	//
	// template - {{template:<template name>}}
	// nest templates by using the keyword 'template' followed by a colon.
	//
	// loop - {{loop:<datapoint>}}{{/loop:datapoint}}
	// loop arrays, arrays of ojects, or objects with the 'loop' keyword.
	// you must close the loop using the data point name (key) of access.
	// $index is a hidden variable containing the increment index.
	//
	// scope - {{scope:<datapoint>}}{{/scope:datapoint}}
	// change object scope using the keyword 'scope.'
	// you must close the scope using the data point name (key) of access.
	//
	// Add your own rules by following the syntax style and creating callbacks in
	// the tempalte.map object. to add custom markup injections, add markup templates
	// to the templates._markup object.
	//
	// ---------------------------------------------------------------------------

	var _d = /{{([^{]+)}}/g;
	var _n = /{{([^}]+)}}(.*)({{\/\1}})/g;
	var _s = /[\r|\t|\n]+/g;

	function template (n, k, t, d) {

		n = n || '';
		t = t || {};
		d = d || {};

		d.$key = k;

		var tmp = template.get(n, t);

		tmp = tmp.replace(_s, '');

		tmp = tmp.replace(_n, function (s, c, h) {
			return template.statements(s, k, c, h, t, d);
		});

		tmp = tmp.replace(_d, function (s, c) {
			return template.inject(s, k, c, t, d)
		});

		return tmp;
	}

	// find template

	template.get = function (n, t) {

		var tmp = n;

		if (t && t.hasOwnProperty(n)) {
			tmp = t[n];
		}

		if (tmp instanceof Array) {
			tmp = tmp.join('');
		}

		return tmp;
	};

	// parse statements only (handlbars that open/close)

	template.statements = function (s, k, c, h, t, d) {

		var p = c.split(':'),
			x = p[ 0 ],
			a = p[ 1 ];

		if (template.map.hasOwnProperty(x)) {
			//if statements get special handling and passed the entire object
			return template.map[ x ]( h, k, t, x == 'if' ? d : (d[ a ] || d), a );
		}
		return '';
	};

	// parse injections (handlebars that are self closing)

	template.inject = function (s, k, c, t, d) {

		var p = c.split( ':' ),
			x = p[ 0 ],
			a = p[ 1 ];

		if (a && template.map.hasOwnProperty(x)) {
			return template.map[x](a, k, t, d, a);
		}

		if (d.hasOwnProperty(x) && (typeof d[x] !== 'undefined') && d[x] !== null) {
			return d[x];
		}
		return '';
	};

	template.markup = {

		highlight: [
			'<span class="highlight">',
				'$1',
			'</span>'
		],

		error: [
			'<span class="error">',
				'{{template}} not found',
			'</span>'
		]
	};

	// a map of the different statements
	// allowed in templates
	//

	template.map = {

		'loop': function (h, k, t, d, a) {


			var b = [], i, x, l, di, idx;

			if (typeof d === 'number' || (x = parseInt(a, 10)) > -1) {

				for (i = 0; i < (x || d); i++) {
					d.$index = i;
					b.push(template(h, k, t, d));
				}
			}
			else if (d instanceof Array) {

				for(i = 0, l = d.length; i < l; i++) {

					di = d[i];

					if (typeof di !== 'object') {
						di = {key: '', value: d[i]};
					}

					di.$index = i;
					b.push(template(h, k, t, di));
				}
			}
			else {
				for (i in d) {

					idx = idx || 0;

					b.push(template(h, k, t, {
						key: i,
						value: d[i],
						$index: idx++
					}));
				}
			}
			return b.join('');
		},

		'if': function (h, k, t, d, a) {

			if (d.hasOwnProperty(a)) {

				var dp = d[a];

				if ((dp !== undefined && dp !== null && dp !== '' && dp !== false)
					|| (dp instanceof Array && dp.length > 0)) {
					return template(h, k, t, d);
				}
			}
			return '';
		},

		'highlight': function (h, k, t, d, a) {

			var hl = d.highlight || '',
				v  = d[h], w;

			if (hl) {
				w = template.get('highlight', template.markup);
				v = v.replace(new RegExp('(' + hl + ')', 'gi'), w);
			}
			return v;
		},

		'scope': function (h, k, t, d, a) {
			return template(h, k, t, d);
		},

		'template': function (h, k, t, d, a) {
			return template(h, k, t, d);
		}
	};

	// eventEmitter
	// used for behavior hooks into components
	// and JavaScript event UI
	// --------------------------------------------------

	var eventEmitter = {

		xname: /^(\w+)\.?/,

		xns: /^\w+(\.?.*)$/,

		_add: function ( bucket, name, handler, context, single ) {

			var e = this.e( name );

			if ( bucket.hasOwnProperty( e.name ) !== true ) {
				 bucket[ e.name ] = [];
			}

			bucket[ e.name ].push({
				ns: e.ns || undefined,
				handler: handler || function () {},
				context: context || null,
				single: single === true
			});
		},

		e: function (e) {

			return {
				name: this.xname.exec( e )[ 1 ] || '',
				ns: ( this.xns.exec( e ) || [] )[ 1 ] || undefined
			};
		},

		args: function (args) {

		    for( var i = 0, a = [], l = args.length;
					i < l && a.push( args[ i ] );
					i++) { }

		    return a;
		},

		on: function on(bucket, event, handler, context) {
			return this._add(bucket, event, handler, context, false);
		},

		one: function(bucket, event, handler, context) {
			return this._add(bucket, event, handler, context, true);
		},

		off: function off (bucket, event, handler) {

			var e = this.e(event), stack, item, ns;

			if (bucket.hasOwnProperty(e.name)) {

				stack = bucket[ e.name ];
				ns = e.ns || undefined;

				for (var i = 0, l = stack.length; i < l; i++) {

					item = stack[ i ];

					if (item.ns === ns && (typeof handler === 'undefined' || handler === item.handler)) {
						stack.splice(i, 1);
						l = stack.length;
						i--;
					}
				}
			}
		},

		emit: function emit (bucket, argz /*, arguments */) {

			var args = this.args(argz),
				event = args.shift(),
				e = this.e( event ),
				stack, item;

			if (bucket.hasOwnProperty(e.name)) {

				stack = bucket[e.name];

				for (var i = 0, l = stack.length; i < l; i++) {

					item = stack[ i ];

					if (!e.ns || item.ns === e.ns) {

						item.handler.apply(item.context || root, args);

						if (item.single) {

							stack.splice(i, 1);
							l = stack.length;
							i--;
						}
					}
				}
			}
		}
	};

	// simple device checking
	//

	var agent  = navigator.userAgent,
		device = {

		agentexp: /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i,

		get is () {
			return this.agentexp.test(agent)
		},

		get id () {
			return (this.agentexp.exec(agent) || [])[1] || ''
		}
	};

	//
	// Mk
	// -----------------------------------

	function Mk() {}

	Mk._$ = $;

	Mk._uid = uid;

	Mk._copy = copy;

	Mk._each = each;

	Mk._property = property;

	Mk._pushsuper = pushsuper;

	Mk._popsuper = popsuper;

	Mk._transition = transition;

	Mk._template = template;

	Mk._eventEmitter = eventEmitter;

	Mk._device = device;

	Mk._keycodes = {
		backspace: 8, tab: 9, enter: 13, esc: 27, space: 32,
		pageup: 33, pagedown: 34, end: 35, home: 36,
		left: 37, up: 38, right: 39, down: 40, left: 37, right: 39,
		comma: 188
	};

	Mk.define = function (n, o) {

		var a = Mk,
			p = n.split( '.' );

		for (var i = 0, l = p.length - 1; i < l; i++) {

			if (!a.hasOwnProperty(p[ i ])) {
				a[ p[ i ] ] = {};
			}
			a = a[ p[ i ] ];
		}
		return a[ p[ p.length - 1 ] ] = o;
	};

	Mk.get = function (n) {

		var o = null,
			m = Mk,
			p = n.split('.');

		for (var i = 0, l = p.length; i < l; i++) {

			if (m.hasOwnProperty( p [ i ] )) {
				o = m[ p[ i ] ];
				m = o;
			}
			else {
				o = null;
			}
		}
		return o;
	};

	Mk.transitions = function (b) {

		if (b === true) {
			Mk._transition.enabled = true;
		} else if (b === false) {
			Mk._transition.enabled = false;
		}
		return Mk._transition.enabled;
	};

	Mk.create = function (name, base, proto) {

		name = name || '';

		proto = proto || base || {};

		base = typeof base === 'function'
			&& base.prototype instanceof Mk
			&& base || Mk;

		var member, statics, obj = function () {
			this._init.apply( this, arguments );
			return this;
		};

		obj.prototype = Object.create(base.prototype);

		for (member in proto) {
			Mk._property(obj.prototype, proto, member);
		}

		if (base !== Mk) {
			for (statics in base) {
				Mk._property(obj, base, statics);
			}
		}

		obj.prototype.constructor = obj;
		obj.prototype._super_ = base;

		return this.define(name, obj);
	};

	Mk.prototype = {

		name: '',

		constructor: Mk,

		templates: {},

		formats: {},

		config: null,

		events: null,

		root: null,

		get _pushsuper_ () {
			return Mk._pushsuper;
		},

		get _popsuper_ () {
			return Mk._popsuper;
		},

		get super () {

			var s = this._stack_[this._stack_.length - 1], m;

			if (s) {
				m = s.super && s.super.prototype
					&& s.super.prototype[s.method];
			}
			return m;
		},

		get keycode () {
			return Mk._keycodes;
		},

		get transitions () {
			return Mk._transition.enabled;
		},

		get version () {
			return 'v1.0.0';
		},

		get element () {
			return this.root[0];
		},

		get device () {
			return Mk._device.is;
		},

		get deviceId () {
			return Mk._device.id;
		},

		$: function (s, c) {
			return Mk._$( s, c );
		},

		uid: function () {
			return Mk._uid();
		},

		copy: function (o) {
			return Mk._copy( o );
		},

		template: function (n, d) {
			return Mk._template(
				n, this.name, this.config.templates, d) ;
		},

		format: function (n, d) {
			return Mk._template(
				n, this.name, this.config.formats, d);
		},

		html: function (t, d) {
			return this.$(this.template(t, d));
		},

		each: function (who, fn) {
			return Mk._each(this, who, fn);
		},

		node: function (n, c) {
			return this.$(this.selector(n), c || this.root || null);
		},

		selector: function (n) {
			return '.' + this.name + (n && '-' + n || '');
		},

		transition: function (node, cb) {

			var $n = this.$(node),
				 t = Mk._transition(),
				 c = this;

				cb = cb || function () {};

			if (t) {

				$n.addClass('transition');

				$n.one(t, function (e) {

					var el = c.$(this);

					cb.call(c, e, el);
					el.removeClass('transition');
				});
				return this;
			}

			$n.removeClass('transition');

			return this.each($n, function (i, n) {
				setTimeout( function () {
					cb.call(c, {}, c.$(n));
				}, 1);
			});
		},

		clearTransitions: function (node) {

			var $n = this.$(node),
				 t = Mk._transition();

			if (t) {
				$n.off(t);
			}

			return this;
		},

		delay: function (fn, ms) {

			var c = this;
			return setTimeout(function () {
				fn.call(c);
			}, ms || 1);
		},

		on: function ( event, handler ) {

			Mk._eventEmitter.on(
				this.events,
				event,
				handler,
				this
			);
			return this;
		},

		one: function ( event, handler ) {

			Mk._eventEmitter.one(
				this.events,
				event,
				handler,
				this
			);
			return this;
		},

		off: function ( event, handler ) {

			Mk._eventEmitter.off(
				this.events,
				event,
				handler
			);
			return this;
		},

		emit: function ( event /*, arguments */ ) {

			Mk._eventEmitter.emit(
				this.events, arguments);
			return this;
		},

		_init: function ( r, o ) {

			// define properties such as:
			// templates, formats, name, etc.
			this._define( r, o );

			//build markup or invoke logic
			this._build();

			//bind events, hooks, messages, etc.
			this._bind();
		},

		_define: function ( r, o ) {

			this.root = this.$( r );

			this.events = {};

			this.config = {
				templates: {},
				formats: {}
			};

			this.each(this.formats, function ( n, v ) {
				this.config.formats[ n ] = v;
			});

			this.each(this.templates, function ( n, v ) {
				this.config.templates[ n ] = v;
			});

			this._config(o);

			return this;
		},

		_config: function (o) {

			o = o || {};

			this.each(o, function (n, v) {

				var looped = false;

				if (typeof v === 'object' && this.config.hasOwnProperty(n)) {

					this.each(v, function (k, vv) {
						this.config[n][k] = vv;
						looped = true;
					});
				}

				if (looped === false) {
					this.config[n] = v;
				}
			});

			return this;
		},

		_param: function (name, type, config, defaultt, elem) {

			var value, t;

			if (config.hasOwnProperty(name)) {
				value = config[name];
			}

			if (typeof value === 'undefined' && type !== 'undefined') {
				value = (elem || this.root).data(name);
			}

			t = typeof value;

			if (t !== type) {

				switch(t) {

					case 'boolean':
						value = value === 'true' || 'false';
						break;

					case 'number':
						value = parseFloat(value, 10);
						break;

					case 'string':
						value = value.toString();

					case 'undefined':
						value = defaultt;
						break;

					case 'object':
						value = value === null
							? defaultt : value;
						break;
				}
			}

			config[name] = value;

			return this;
		},

		_build: function () {},

		_bind: function () {}
	};

	return Mk;
});