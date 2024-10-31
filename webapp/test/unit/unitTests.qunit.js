/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"stock_analytics/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});
