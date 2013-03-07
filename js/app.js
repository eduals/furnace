/* NASA Furnace Application */

	/* GAS FUNCTION CASCADE */
	//Call setSpecfO2.
	//Call mixRatio.
	//Call validateMixRatio.
	//Call calculateReferencefO2.
	//Call setEMFVars.
	//Call calculatedEMFdT.
	//Call calculatedfO2dfCO2.
	//Save original vars for reset.

	var APP = {
		calculator : "GAS",
		processGAS : function () {
			var Gas = GAS;
			this.calculator = "GAS";
			$('div#gas').find('input').each(function () {
				Gas[$(this).attr('name')] = $(this).val();
			});
			GAS.startProcess();
		},
		initApp : function () { return true; }
	};

	/* GAS */
	var GAS = {

		RM : function (x, y) { return (x - 3 * x * Math.pow(10, y) - 2 * Math.pow(Math.pow(10, y), (3 / 2)) / (2 * x * Math.pow(10, y) + Math.pow(10, y) + Math.pow(Math.pow(10, y), (3 / 2)) + Math.sqrt(Math.pow(10, y)))); },
		x : 0,
		y : 0,
		r : 0.00198726,
		t : 0,
		tc : 1400, 				// Sample temperature
		tref : 1065, 			// Reference temperature
		fO2Offset2 : 100, 		// Sample O2 fugacity offset
		logfO2 : 0,				// O2 fugacity
		reffO2 : 100,			// Reference fO2
		stepfO2 : 1,			// fO2 step variable
		stepfO2Flag: true, 		// flag for deltaFO2
		fCO2 : 0,				// CO2 fugacity
		mixRatio : 0,			// Gas mix ratio
		volCO2 : 0,				// CO2 volume
		dVolCO2 : 0,			// delta CO2 volume
		buffer : "IW", 			// Fugacity reference buffer
		specfO2 : -10.69719,	// Fugacity value
		corrEMF : 26, 			// Zirconia cell correction
		idealEMF : null,
		realEMF : null,
		deltafO2deltaCO2 : null,
		deltaEMFdeltafO2 : null,
		deltaEMFdeltaT : null,
		stableC : false,
		resetVars : function () { return true; },
		resetAllVars : function () { /* reset vars from object store.*/ },
		startProcess : function () {
			this.resetVars = this;
			$(document).trigger('parseinput');
		},
		parseInput : function () {
			this.tc = parseFloat(this.tc);
			this.specfO2 = (parseFloat(this.specfO2) !== NaN) ? parseFloat(this.specfO2) : "MANUAL";
			this.fO2Offset2 = parseFloat(this.fO2Offset2);
			$(document).trigger('setspecfo2');
		},
		setSpecfO2 : function () {
			var tcOffset = (this.tc + 273);
			switch (this.buffer) {
			case "IW":
				this.specfO2 = (6.57 - (27215 / tcOffset)) + this.fO2Offset2;
				break;
			case "WM":
				this.specfO2 = (13.12 - (32730 / tcOffset)) + this.fO2Offset2;
				break;
			case "MH":
				this.specfO2 = (13.966 - (24634 / tcOffset)) + this.fO2Offset2;
				break;
			case "QFM":
				this.specfO2 = (9.0 - (25738 / tcOffset)) + this.fO2Offset2;
				break;
			case "NNO":
				this.specfO2 = (9.359999 - (24930 / tcOffset)) + this.fO2Offset2;
				break;
			case "MANUAL":
				this.setManualfO2(this.specfO2);
				break;
			default:
				break;
			}
			$(document).trigger('setmixratio');
		},
		setManualfO2 : function () {
			var adjTC = this.tc + 273;
			switch (this.buffer) {
			case "IW":
				this.fO2Offset2 = this.specfO2 - (6.57 - 27215 / adjTC);
				break;
			case "WM":
				this.fO2Offset2 = this.specfO2 - (13.12 - 32730 / adjTC);
				break;
			case "MH":
				this.fO2Offset2 = this.specfO2 - (13.966 - 24634 / adjTC);
				break;
			case "QFM":
				this.fO2Offset2 = this.specfO2 - (9 - 25738 / adjTC);
				break;
			case "NNO":
				GAS.fO2Offset2 = GAS.specfO2 - (9.359999 - 24930 / adjTC);
				break;
			default:
				GAS.fO2Offset2 = GAS.specfO2 - (6.57 - 27215 / adjTC);
				break;
			}
			$(document).trigger('setmixratio');
		},
		setMixRatio : function () {
			// Variables
			var gas1, gas2, k1, k2, a = 0, logfO2 = GAS.specfO2, t = GAS.tc;

			//Calculations
			gas1 = 62.110326 + t * (-0.02144446) + Math.pow(t, 2) * (4.720326) * Math.pow(10, -7) + Math.pow(t, 3) * (-4.5574288) * Math.pow(10, -12) + Math.pow(t, 4) * (-7.343018200000001) * Math.pow(10, -15);
			gas2 = 94.25770200000001 + t * (7.321945) * Math.pow(10, -4) - Math.pow(t, 2) * Math.pow(10, -7) * 3.146474 + Math.pow(t, 3) * 4.7858617 * Math.pow(10, -11);
			k1 = Math.exp(-gas1 / (GAS.r * (t + 273.18)));
			k2 = Math.exp(-gas2 / (GAS.r * (t + 273.18)));
			a = (k1 - Math.sqrt(Math.pow(10, logfO2))) * GAS.RM(k1, logfO2) / (k1 + Math.sqrt(Math.pow(10, logfO2)));

			// Set program vars
			GAS.fCO2 = 2 * (1 - a) / (2 + a + 2 * GAS.RM(k1, logfO2));
			GAS.volCO2 = 100 / (1 + GAS.RM(k1, logfO2));
			GAS.dVolCO2 = 100 / (1 + GAS.RM(k1, (logfO2 + 0.1))) - 100 / (1 + GAS.RM(k1, (logfO2 - 0.1))) / 2;

			// Set carbon stability notification - if carbon will precipitate, set to true to display message
			if (Math.pow(10, logfO2) < (k2 * GAS.fCO2)) { GAS.stableC = true; }
			if (GAS.stepfO2Flag){
				$(document).trigger('validatemixratio');
			} else {
				return true;
			}
		},
		validateMixRatio : function () {
			if (GAS.volCO2 < 100) {
				GAS.mixRatio = GAS.volCO2;
				$(document).trigger('calculatereferencefo2');
			} else {
				$(document).trigger('badmixratio').trigger('resetallvars');
			}
		},
		calculateReferencefO2 : function () {
			var deltaRatio = null;
			if (!(GAS.tc > GAS.tref || GAS.tc === GAS.tref)) { GAS.stepfO2 = -GAS.stepfO2; }
			GAS.t = GAS.tref;
			GAS.stepfO2Flag = false;
			deltaRatio = GAS.calculateDeltaRatio(GAS.stepfO2);
			if (deltaRatio < 0) {
				while (Math.abs(deltaRatio) < 0.001 && deltaRatio !== 0) {
					GAS.logfO2 = GAS.logfO2 + GAS.stepfO2;
					GAS.stepfO2 = GAS.stepfO2 / 2;
					deltaRatio = GAS.calculateDeltaRatio();
				}
			} else {
				while (Math.abs(deltaRatio) < 0.001 && deltaRatio !== 0) {
					GAS.logfO2 = GAS.logfO2 - GAS.stepfO2;
					GAS.stepfO2 = GAS.stepfO2 / 2;
					deltaRatio = GAS.calculateDeltaRatio();
				}
			}
			GAS.reffO2 = GAS.logfO2;
			$(document).trigger('setemfvars');
		},
		calculateDeltaRatio : function () {
			GAS.logfO2 = GAS.logfO2 - GAS.stepfO2;
			GAS.setMixRatio(GAS.logfO2);
			var deltaRatio = GAS.mixRatio - GAS.volCO2;
			return deltaRatio;
		},
		setEMFVars : function () {
			GAS.idealEMF = GAS.calculateEMF(GAS.tref, GAS.reffO2);
			GAS.realEMF = GAS.idealEMF + GAS.corrEMF;
			GAS.deltaEMFdeltafO2 = (GAS.calculateEMF(GAS.tref, (GAS.reffO2 + 0.1)) - GAS.calculateEMF(GAS.tref, (GAS.reffO2 - 0.1))) / 2;
			GAS.deltaEMFdeltaT = GAS.calculatedEMFdT();
			$(document).trigger('calculatedemfdt');
		},
		calculateEMF : function (t, f) {
			return (0.0496055 * (t + 273) * (f + 0));
		},
		calculatedEMFdT : function () {
			var z = 1, q = {};
			var ratio = GAS.fCO2 / (1 - GAS.fCO2 - Math.pow(10, GAS.reffO2));
			var aa = (1 - 2 * ratio * (100 / GAS.mixRatio - 1)) / (1 + 2 * ratio * (100 / GAS.mixRatio - 1));
			var part = Math.log(1 - aa) - Math.log(100 / GAS.mixRatio - 1);
			var h = 1;

			while (h > -2) {
				var w = GAS.t + h;
				var gg = 62.110326 - 0.02144446 * w + 0.0000004720326 * (Math.pow(w, 2)) + (-4.5574288) * (Math.pow(10, -12)) * (Math.pow(w, 3)) - 7.343018200000001 * (Math.pow(10, -15)) * (Math.pow(w, 4));
				var kk = Math.exp(-gg / (GAS.r * (w + 273.18)));
				q[z]= kk;
				z++;
				h = h - 2;
			}

			var newfO2a = Math.log(10) * 0.5 * (Math.log(q[1]) + part);
			var newfO2b = Math.log(10) * 0.5 * (Math.log(q[2]) + part);
			GAS.deltaEMFdeltaT = (GAS.calculateEMF(GAS.tref + 1, newfO2a) - GAS.calculateEMF(GAS.tref - 1, newfO2b)) / 2;
			$(document).trigger('calculatedfo2dfco2');
		},
		calculatedfO2dfCO2 : function () {
			GAS.deltafO2deltaCO2 = 0.1/GAS.dVolCO2;
			$(document).trigger('outputgas');
		},
		showBadMixError : function () {
			//Popup for bad mix ratio.  Then resets vars.
		},
		formatOutput : function () {
			var tpl = $('script#gas-output-template').html();
			var html = Mustache.render(tpl, GAS);
			$('#gas-output-area').html(html);
			$(document).trigger('showgas');
		},
		showOutput : function () {
			$('#gas-output-area', "div#gas").show();
		}
	};

//Click handlers.
$('a[name="process"]', 'div#gas').click(function () { APP.processGAS(); });

//Custom event bindings.
$(document).bind('setmixratio', GAS.setMixRatio);
$(document).bind('validatemixratio', GAS.validateMixRatio);
$(document).bind('badmixratio', GAS.showBadMixError);
$(document).bind('parseinput', GAS.parseInput);
$(document).bind('setspecfo2', GAS.setSpecfO2);
$(document).bind('calculatereferencefo2', GAS.calculateReferencefO2);
$(document).bind('setemfvars', GAS.setEMFVars);
$(document).bind('calculatedemfdt', GAS.calculatedEMFdT);
$(document).bind('calculatedfo2dfo2', GAS.calculatedfO2dfCO2);
$(document).bind('outputgas', GAS.formatOutput);
$(document).bind('showgas', GAS.showOutput);
