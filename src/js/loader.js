/*

	Loader
	Dependencies: core

	Events:

	<event:show>
		<desc>Fires when the loader is shown.</desc>
		<example>
			instance.on('show', function (data) {
				console.info('loader is visible!');
			});
		</example>
	</event:show>

	<event:hide>
		<desc>Fires when the loader is hidden.</desc>
		<example>
			instance.on('hide', function () {
				console.info('loader is now gone!');
			});
		</example>
	</event:hide>

	<event:focus>
		<desc>Fired when focus is re-shifted to the root.</desc>
		<example>
			instance.on('focus', function () {
				console.info('Focus reshifted!');
			});
		</example>
	</event:focus>
*/
(function ( root, factory ) {
	//
	// AMD support
	// ---------------------------------------------------
	if ( typeof define === 'function' && define.amd ) {

		define( [ 'mk' ], function ( mk ) {
			return factory( root, mk );
		});
	}
	//
	// CommonJS module support
	// -----------------------------------------------------
	else if ( typeof module === 'object' && module.exports ) {

		module.exports = factory( root, require( 'mk' ));
	}
	//
	// Everybody else
	// -----------------------------------------------------
	else {
		return factory( root, root.Mk );
	}

})( typeof window !== "undefined" ? window : this, function ( root, mk ) {

	mk.create('Loader', {

		name: 'mk-ld',

		templates: {
			shadow:
				`<div class="{{$key}}-shadow">
					{{template:overlay}}
					{{template:alert}}
				</div>`,

			overlay:
				`<div class="{{$key}}-overlay" aria-hidden="true">
					{{loop:6}}
						<div class="disk disk-{{$index}}" />
					{{/loop:6}}
				</div>`,

			alert: `<div role="alert" class="{{$key}}-alert">{{message}}</div>`,
			focus: `<button role="presentation" />`
		},

		formats: {
			message: 'Loading content, please wait.'
		},

		get version () {
			return 'v1.0.0';
		},

		/*
			<property:refocus>
				<desc>Boolean representing if focus shifting should occur after new results are loaded. Default is true.</desc>
			</property:refocus>
		*/

		get refocus () {
			return this.config.refocus;
		},

		_config: function (o) {

			o = o || {};

			this._param('refocus', 'boolean', o, true);
			this.super(o);
		},

		/*
			<method:show>
				<invoke>.show()</invoke>
				<desc>Show the loader and notify screen readers.</desc>
			</method:show>
		*/

		show: function () {

			var r = this.root,
				b = r.attr('aria-busy'),
				o;

			if (b !== 'true') {

				this.shadow = this.html('shadow', {
					message: this.config.formats.message
				}).appendTo(r);

				o = this.node('overlay', this.shadow);

				if (this.transitions) {
					o.addClass('transition');
				}

				this.delay(function () {
					o.addClass('in');
					r.attr('aria-busy', 'true');
					this.emit('show');
				});
			}
			return this;
		},

		/*
			<method:hide>
				<invoke>.hide()</invoke>
				<desc>Hide loaders, notify screen readers, and shift focus back to the top of the module if focus flag is set to true.</desc>
			</method:hide>
		*/

		hide: function () {

			var r = this.root,
				b = r.attr('aria-busy'),
				o;

			if (b === 'true') {

				o = this.node('overlay', this.shadow);
				o.removeClass('in');

				this.transition(o, function () {

					r.attr('aria-busy', 'false');

					this.shadow.remove();
					this.shadow = null;
					this.emit('hide');
				});
			}

			if (this.refocus) {
				return this.focus();
			}
			return this;
		},

		/*
			<method:toggle>
				<invoke>.toggle()</invoke>
				<desc>Toggles between hide() and show().</desc>
			</method:toggle>
		*/

		toggle: function () {

			if (this.root.attr('aria-busy') === 'true') {
				return this.hide();
			}
			return this.show();
		},

		/*
			<method:focus>
				<invoke>.focus()</invoke>
				<desc>Refocuses screen reader context back to the top of the root element.</desc>
			</method:focus>
		*/

		focus: function () {

			this.html('focus')
				.prependTo(this.root)
				.focus()
				.remove();

			this.emit('focus');

			return this;
		}
	});

	return mk.get('Loader');
});