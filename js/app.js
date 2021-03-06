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
		GAS : null,
		gasrev2 : null,
		RAMP : null,
		CALIB3 : null,
		calculator : null,
		processGAS : function () {
			var app = this;
			this.GAS = window.GAS;
			this.GAS.calculator = "gas";
			this.GAS.resetAllVars();
			$('div#gas').find('input, select').each(function () {
				app.GAS[$(this).attr('name')] = $(this).val();
			});
			//this.GAS.buffer = $('select.buffer', 'div#gas').val();
			this.GAS.startProcess();
		},
		resetGAS : function () { this.GAS.resetAllVars(); $('.gas-output-area').empty(); },
		processgasrev2 : function () {
			var app = this;
			this.GAS = window.GAS;
			this.GAS.calculator = "gasrev2";
			$('div#gasrev2').find('input, select').each(function () {
				app.GAS[$(this).attr('name')] = $(this).val();
			});
			this.GAS.startProcess();
		},
		processRamp : function () {
			var app = this;
			this.GAS = window.GAS;
			this.GAS.calculator = "ramp";
			$('div#ramp').find('input, select').each(function () {
				app.GAS[$(this).attr('name')] = $(this).val();
			});
			this.GAS.startRamp();
		},
		initApp : function () { return true; }
	};

	/* GAS */
	var GAS = {

		calculator : null,
		RM : function (x, y) { return (x-3*x*Math.pow(10,y)-2*(Math.pow(Math.pow(10,y),(3/2))))/(2*x*Math.pow(10,y)+Math.pow(10, y)+(Math.pow(Math.pow(10,y),(3/2)))+Math.sqrt(Math.pow(10,y))); },
		x : null,
		y : null,
		r : 0.00198726,
		t : null,
		tc : null, 				// Sample temperature
		tref : null, 			// Reference temperature
		tfinal: null, 			// Final temperature (RAMP only)
		fO2Offset2 : 100, 		// Sample O2 fugacity offset
		logfO2 : null,			// O2 fugacity
		specfO2 : null,			// Fugacity value
		reffO2 : null,			// Reference fO2
		stepfO2 : 1,			// fO2 step variable
		stepfO2Flag: true, 		// flag for deltaFO2 calculations
		continueRatio: false,	// flag for continuing calculations with a > 100% gas mix
		deltaRatio : null,		// ratio between sample and reference fO2
		fCO2 : null,			// CO2 fugacity
		mixRatio : null,		// Gas mix ratio
		refRatio : null,		// True reference mix ratio (mixRatio - dVolCO2)
		specRatio : null,		// True specimen mix ratio (mixRatio - dVolCO2)
		volCO2 : null,			// CO2 volume
		dVolCO2 : null,			// delta CO2 volume
		buffer : "IW", 			// Fugacity reference buffer
		corrEMF : 26, 			// Zirconia cell correction
		idealEMF : null,
		realEMF : null,
		dfO2dCO2 : null,
		dCO2dfO2ref : null,
		dCO2dfO2spec : null,
		dEMFdfO2 : null,
		dEMFdT : null,
		stableC : false,
		lastRun : {},
		rampData: [],
		rampstep: 0,
		defaultVars : {
			"x": 0,
			"y": 0,
			"r": 0.00198726,
			"t": 0,
			"tc": null,
			"tref": null,
			"tfinal": null,
			"reffO2": null,
			"fO2Offset2": null,
			"stepfO2": 1,
			"stepfO2Flag": true,
			"deltaRatio": null,
			"fCO2": null,
			"mixRatio": null,
			"refRatio": null,
			"volCO2": null,
			"dVolCO2": null,
			"buffer": "IW",
			"specfO2": null,
			"corrEMF": null,
			"idealEMF" : null,
			"realEMF" : null,
			"dfO2dCO2" : null,
			"dEMFdfO2" : null,
			"dEMFdT" : null,
			"stableC" : false,
			"rampData" : [],
			"rampstep" : 0,
		},
		resetAllVars : function () {
			for(var key in GAS.defaultVars) {
				GAS[key] = GAS.defaultVars[key];
			}
		},
		startProcess : function () {
			GAS.lastRun = GAS;
			$(document).trigger('parseinput');
		},
		startRamp : function () {
			if(GAS.parseInput()){
				GAS.makeRampData();
			}
		},
		makeRampData : function () {
			GAS.lastRun = GAS;
			var t = GAS.tref = GAS.tc;
			var endrun = false;
			GAS.stepfO2Flag = false;
			var index = 0;
			while (!endrun) {
				var fg = GAS.calculatefO2Object(GAS.specfO2, t, GAS.fO2Offset2);
				var mix = GAS.calcMixRatio(fg.fo2,t);
				if(!GAS.validateRatio(mix.co2)){
					$(document).trigger('badmixratio');
					return false;
				}
				if (GAS.mixRatio == null){
					GAS.mixRatio = mix.co2;
				}
				var calib = GAS.iteratefO2(fg.fo2, t, GAS.tfinal, mix);
				//console.debug(calib);
				GAS.rampData[index] = calib;
				GAS.rampData[index]['temp'] = t;
				GAS.rampData[index]['diff'] = GAS.mixRatio - calib.mix;

				if (t == GAS.tfinal){
					endrun = true;
				} else {
					if(GAS.tfinal > GAS.tc){
						t = t + GAS.rampstep;
						if (t > GAS.tfinal){
							t = GAS.tfinal;
						}
					} else {
						t = t - GAS.rampstep;
						if(t < GAS.tfinal){
							t = GAS.tfinal;
						}
					}
				}
				index++;
			}
			$(document).trigger('outputgas');
		},
		parseInput : function () {
			GAS.tc = parseFloat(GAS.tc);
			GAS.tref = parseFloat(GAS.tref);
			GAS.corrEMF = parseFloat(GAS.corrEMF);
			GAS.tfinal = parseFloat(GAS.tfinal);
			GAS.rampstep = parseInt(GAS.rampstep);
			if (GAS.calculator == "gas"){
				GAS.parsefO2Input("specfO2");
			}
			if (GAS.calculator == "gasrev2"){
				if (GAS.fO2Offset2 == "EMF") {
					GAS.reffO2 = null;
					GAS.buffer = "EMF";
				} else {
					GAS.parsefO2Input('reffO2');
				}
				GAS.realEMF = parseFloat(GAS.realEMF);
			}
			if (GAS.calculator == "ramp") {
				GAS.parsefO2Input("specfO2");
			}
			GAS.stepfO2Flag = true;
			if (GAS.calculator !== "ramp") {
				$(document).trigger('setspecfo2');
			} else {
				return true;
			}
		},
		parsefO2Input : function (fo2) {
			if (GAS[fo2] !== "") {
				GAS.buffer = "MANUAL";
				GAS[fo2] = parseFloat(GAS[fo2]);
				GAS.logfO2 = GAS[fo2];
				GAS.fO2Offset2 = 0;
			} else {
				GAS.fO2Offset2 = parseFloat(GAS.fO2Offset2);
			}
		},
		setSpecfO2 : function () {
			var t = GAS.setTempVar();
			var fo2 = GAS.setfO2Var();
			var tOffset = (GAS[t] + 273);
			switch (GAS.buffer) {
			case "IW":
				GAS[fo2] = (6.57 - (27215 / tOffset)) + GAS.fO2Offset2;
				break;
			case "WM":
				GAS[fo2] = (13.12 - (32730 / tOffset)) + GAS.fO2Offset2;
				break;
			case "HM":
				GAS[fo2] = (13.966 - (24634 / tOffset)) + GAS.fO2Offset2;
				break;
			case "QFM":
				GAS[fo2] = (9.0 - (25738 / tOffset)) + GAS.fO2Offset2;
				break;
			case "NNO":
				GAS[fo2] = (9.359999 - (24930 / tOffset)) + GAS.fO2Offset2;
				break;
			case "MANUAL":
				GAS.setManualfO2(fo2);
				break;
			case "EMF":
				GAS.setfO2byEMF();
				break;
			default:
				break;
			}
			GAS.logfO2 = GAS[fo2];
			$(document).trigger('setmixratio');
		},
		setTempVar : function () {
			switch (GAS.calculator) {
				case "gas":
					return "tc";
					break;
				case "gasrev2":
					return "tref";
					break;
				default:
					return "tc";
					break;
			}
		},
		setfO2Var : function () {
			switch (GAS.calculator) {
				case "gas":
					return "specfO2";
					break;
				case "gasrev2":
					return "reffO2";
					break;
				default:
					return "specfO2";
					break;
			}
		},
		setManualfO2 : function (fo2) {
			var adjTC = GAS.tc + 273;
			switch (GAS.buffer) {
			case "IW":
				fo2off = GAS[fo2] - (6.57 - (27215 / adjTC));
				break;
			case "WM":
				fo2off = GAS[fo2] - (13.12 - (32730 / adjTC));
				break;
			case "HM":
				fo2off = GAS[fo2] - (13.966 - (24634 / adjTC));
				break;
			case "QFM":
				fo2off = GAS[fo2] - (9 - (25738 / adjTC));
				break;
			case "NNO":
				fo2off = GAS[fo2] - (9.359999 - (24930 / adjTC));
				break;
			default:
				fo2off = GAS[fo2] - (6.57 - (27215 / adjTC));
				break;
			}
			if (GAS.calculator !== "ramp"){
				GAS.fO2Offset2 = fo2off;
				GAS.logfO2 = GAS[fo2];
				$(document).trigger('setmixratio');
			} else {
				return fo2off;
			}
		},
		calculatefO2Object : function (fo2, temp, offset) {
			var adjTC = temp + 273; var _fo2 = undefined; ret = {};
			if(fo2 !== "" && offset !== 0){
				switch (GAS.buffer) {
				case "IW":
					offset = fo2 - (6.57 - (27215 / adjTC));
					break;
				case "WM":
					offset = fo2 - (13.12 - (32730 / adjTC));
					break;
				case "HM":
					offset = fo2 - (13.966 - (24634 / adjTC));
					break;
				case "QFM":
					offset = fo2 - (9 - (25738 / adjTC));
					break;
				case "NNO":
					offset = fo2 - (9.359999 - (24930 / adjTC));
					break;
				case "MANUAL":
					offset = GAS.calculatefO2Offset(fo2);
					break;
				default:
					offset = fo2 - (6.57 - (27215 / adjTC));
					break;
				}
			} else {
				switch (GAS.buffer) {
					case "IW":
						_fo2 = (6.57 - (27215 / adjTC)) + offset;
						break;
					case "WM":
						_fo2 = (13.12 - (32730 / adjTC)) + offset;
						break;
					case "HM":
						_fo2 = (13.966 - (24634 / adjTC)) + offset;
						break;
					case "QFM":
						_fo2 = (9.0 - (25738 / adjTC)) + offset;
						break;
					case "NNO":
						_fo2 = (9.359999 - (24930 / adjTC)) + GAS.fO2Offset2;
						break;
					case "MANUAL":
						_fo2 = fo2;
						break;
					case "EMF":
						GAS.setfO2byEMF();
						break;
					default:
						break;
				}
			}
			if (GAS.calculator !== "ramp"){
				$(document).trigger('setMixRatio');
			} else {
				ret.fo2 = _fo2;
				ret.fo2Off = offset;
				return ret;
			}
		},
		setfO2byEMF : function () {
			GAS.idealEMF = GAS.realEMF - GAS.corrEMF;
			GAS.reffO2 = GAS.logfO2 = GAS.idealEMF / (0.0496055 * (GAS.tref + 273));
			if (GAS.calculator == "gasrev2") {
				GAS.stepfO2Flag = true;
				if($(document).trigger('setmixratio')){
					GAS.validateMixRatio();
				}
			}
		},
		calculatefO2Offset : function (fo2) {
			var f = (undefined !== fo2) ? fo2 : GAS.specfO2;
			var offset;
			switch (GAS.buffer) {
			case "IW":
				offset = f - (6.57 - (27215 / adjTC));
				break;
			case "WM":
				offset = f - (13.12 - (32730 / adjTC));
				break;
			case "HM":
				offset = f - (13.966 - (24634 / adjTC));
				break;
			case "QFM":
				offset = f - (9 - (25738 / adjTC));
				break;
			case "NNO":
				offset = f - (9.359999 - (24930 / adjTC));
				break;
			default:
				offset = f - (6.57 - (27215 / adjTC));
				break;
			}

			if (GAS.calculator !== "ramp") {
				GAS.fO2Offset2 = offset;
			} else {
				return offset;
			}
		},
		setMixRatio : function () {
			// Variables
			var gas1, gas2, k1, k2, a = 0;
			var t = (GAS.stepfO2Flag) ? GAS.tc : GAS.tref;
			fO2 = GAS.logfO2;
			//Calculations
			gas1 = 62.110326 + t * (-0.02144446) + Math.pow(t, 2) * (4.720326) * Math.pow(10, -7) + Math.pow(t, 3) * (-4.5574288) * Math.pow(10, -12) + Math.pow(t, 4) * (-7.343018200000001) * Math.pow(10, -15);
			gas2 = 94.25770200000001 + t * (7.321945) * Math.pow(10, -4) - Math.pow(t, 2) * Math.pow(10, -7) * 3.146474 + Math.pow(t, 3) * 4.7858617 * Math.pow(10, -11);
			k1 = Math.exp(-gas1 / (GAS.r * (t + 273.18)));
			k2 = Math.exp(-gas2 / (GAS.r * (t + 273.18)));
			a = (k1 - Math.sqrt(Math.pow(10, fO2))) * GAS.RM(k1, fO2) / (k1 + Math.sqrt(Math.pow(10, fO2)));
			// Set program vars
			var RM = GAS.RM(k1, fO2);
			GAS.fCO2 = 2 * (1 - a) / (2 + a + 2 * RM);
			GAS.volCO2 = 100 / (1 + GAS.RM(k1, fO2));
			GAS.dVolCO2 = 100 / (1 + GAS.RM(k1, (fO2 + 0.1))) - 100 / (1 + GAS.RM(k1, (fO2 - 0.1))) / 2;
			// Set carbon stability notification - if carbon will precipitate, set to true to display message
			if (Math.pow(10, fO2) < (k2 * GAS.fCO2)) { GAS.stableC = true; }
			if (GAS.stepfO2Flag) {
				$(document).trigger('validatemixratio');
			} else {
				return true;
			}
		},
		calcMixRatio : function (fO2, temp) {
			// Variables
			var gas1, gas2, k1, k2, a = 0;
			var t = (GAS.stepfO2Flag) ? GAS.tc : GAS.tref;
			if (temp !== undefined) {
				t = temp;
			}
			//Calculations
			gas1 = 62.110326 + t * (-0.02144446) + Math.pow(t, 2) * (4.720326) * Math.pow(10, -7) + Math.pow(t, 3) * (-4.5574288) * Math.pow(10, -12) + Math.pow(t, 4) * (-7.343018200000001) * Math.pow(10, -15);
			gas2 = 94.25770200000001 + t * (7.321945) * Math.pow(10, -4) - Math.pow(t, 2) * Math.pow(10, -7) * 3.146474 + Math.pow(t, 3) * 4.7858617 * Math.pow(10, -11);
			k1 = Math.exp(-gas1 / (GAS.r * (t + 273.18)));
			k2 = Math.exp(-gas2 / (GAS.r * (t + 273.18)));
			a = (k1 - Math.sqrt(Math.pow(10, fO2))) * GAS.RM(k1, fO2) / (k1 + Math.sqrt(Math.pow(10, fO2)));
			// Set program vars
			var RM = GAS.RM(k1, fO2);
			var fCO2 = 2 * (1 - a) / (2 + a + 2 * RM);
			var volCO2 = 100 / (1 + GAS.RM(k1, fO2));
			var dVolCO2 = 100 / (1 + GAS.RM(k1, (fO2 + 0.1))) - 100 / (1 + GAS.RM(k1, (fO2 - 0.1))) / 2;
			// Set carbon stability notification - if carbon will precipitate, set to true to display message
			if (Math.pow(10, fO2) < (k2 * GAS.fCO2)) { GAS.stableC = true; }

			var ret = {}; 
			ret.co2 = volCO2; 
			ret.dco2 = dVolCO2; 
			ret.fO2 = fO2;
			ret.precipC = GAS.stableC;
			ret.mix = volCO2;

			return ret;
		},
		validateMixRatio : function () {
			if (GAS.volCO2 < 100.0 && GAS.volCO2 > 0) {
				GAS.mixRatio = GAS.volCO2;
				GAS.dCO2dfO2ref = GAS.dVolCO2;
				if (GAS.calculator == "gasrev2") {
					$(document).trigger('calculatespecimenfo2');
				}
				if (GAS.calculator == "gas") {
					$(document).trigger('calculatereferencefo2');
				}
			} else {
				GAS.continueRatio = false;
				$(document).trigger('badmixratio');
			}
		},
		validateRatio : function (ratio) {
			return (ratio > 0 && ratio < 100.0);
		},
		calculateReferencefO2 : function () {
			var tDelta = tRatio = 1;
			//if (GAS.tc <= GAS.tref) { GAS.stepfO2 = -1; }
			GAS.stepfO2Flag = false;
			var step = 1; var done = false; var i = 1;
			while (Math.abs(tDelta) > 0.001) {
				if (GAS.tref < GAS.tc) {
					tRatio = GAS.calcMixRatio(GAS.logfO2 - (step * i));
					tDelta = GAS.calcDeltaRatio(tRatio);
					if (tDelta < 0) {
						i++;
					} else {
						step = step / 2;
						i = 1;
					}
				} else {
					tRatio = GAS.calcMixRatio(GAS.logfO2 + (step * i));
					tDelta = GAS.calcDeltaRatio(tRatio);
					if (tDelta > 0) {
						i++;
					} else {
						step = step / 2;
						i = 1;
					}
				}
			}
			GAS.reffO2 = GAS.logfO2 = tRatio.fO2;
			GAS.deltaRatio = tDelta;
			GAS.refRatio = GAS.mixRatio - tDelta;
			$(document).trigger('setemfvars');
		},
		calculateSpecimenfO2 : function () {
			var tDelta = tRatio = 1;
			//if (GAS.tc <= GAS.tref) { GAS.stepfO2 = -1; }
			GAS.stepfO2Flag = false;
			var step = 1; var done = false; var i = 1;
			while (Math.abs(tDelta) > 0.001) {
				if (GAS.tref < GAS.tc) {
					tRatio = GAS.calcMixRatio(GAS.logfO2 - (step * i));
					tDelta = GAS.calcDeltaRatio(tRatio);
					if (tDelta < 0) {
						i++;
					} else {
						step = step / 2;
						i = 1;
					}
				} else {
					tRatio = GAS.calcMixRatio(GAS.logfO2 + (step * i));
					tDelta = GAS.calcDeltaRatio(tRatio);
					if (tDelta > 0) {
						i++;
					} else {
						step = step / 2;
						i = 1;
					}
				}
			}
			GAS.specfO2 = GAS.logfO2 = tRatio.fO2;
			GAS.deltaRatio = tDelta;
			GAS.specRatio = GAS.mixRatio - tDelta;
			GAS.dCO2dfO2spec = GAS.dVolCO2;
			$(document).trigger('outputgas');
		},
		iteratefO2 : function (fO2, temp, tfinal, mix) {
			var tDelta = tRatio = 1;
			var step = 1; var stepTotal = 0; var _fo2 = fO2; var lastDelta = 0;
			//step = (tfinal > temp)? -(step) : step;
			stepTotal = step;
			while (Math.abs(tDelta) > 0.001) {
				if (tfinal >= temp) {
					_fo2 = fO2 - stepTotal;
					tRatio = GAS.calcMixRatio(_fo2, temp);
					tDelta = GAS.calcDeltaRatio(tRatio);
					if (tDelta < 0) {
						step = step / 2;
						stepTotal += step;
					} else {
						stepTotal -= step;
					}
					lastDelta = tDelta;
				} else if (tfinal < temp) {
					_fo2 = fO2 + stepTotal;
					tRatio = GAS.calcMixRatio(_fo2, temp);
					tDelta = GAS.calcDeltaRatio(tRatio);
					if (tDelta > 0) {
						step = step / 2;
						stepTotal += step;
					} else {
						stepTotal -= step;
					}

					lastDelta = tDelta;
				}
			}
			if (GAS.calculator !== "ramp"){
				return {"fO2" : tRatio.fO2, "ratio": GAS.mixRatio };
			} else {
				return tRatio;
			}
		},
		calcDeltaRatio : function (obj){
			return GAS.mixRatio - obj.co2;
			//return obj.mix - obj.co2;
		},
		calculateDeltaRatio : function () {
			var dR = GAS.mixRatio - GAS.volCO2;
			return dR;
		},
		setEMFVars : function () {
			GAS.idealEMF = GAS.calculateEMF(GAS.tref, GAS.reffO2);
			GAS.realEMF = GAS.idealEMF + GAS.corrEMF;
			GAS.dEMFdfO2 = (GAS.calculateEMF(GAS.tref, (GAS.reffO2 + 0.1)) - GAS.calculateEMF(GAS.tref, (GAS.reffO2 - 0.1))) / 2;
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
			GAS.dEMFdT = (GAS.calculateEMF(GAS.tref + 1, newfO2a) - GAS.calculateEMF(GAS.tref - 1, newfO2b)) / 2;
			$(document).trigger('calculatedfo2dfco2');
		},
		calculatedfO2dfCO2 : function () {
			GAS.dfO2dCO2 = 0.1/GAS.dVolCO2;
			$(document).trigger('outputgas');
		},
		showBadMixError : function () {
			$('div#bad-ratio-popup').modal();
			$('#gas-output-area').empty();
		},
		mixRatioResume : function () {
			if (GAS.calculator == "gasrev2") {
				GAS.continueRatio = true;
				$(document).trigger('setmixratio');
			}
		},
		formatOutput : function () {
			var tp = "script#" + GAS.calculator + "-output-template";
			var tpl = $(tp).html();
			var html = Mustache.render(tpl, GAS);
			var ctx = "div#" + GAS.calculator;
			$('.gas-output-area', ctx).html(html);
			$('.float').each(function(){
				$(this).text(parseFloat($(this).text()).toPrecision(6));
				console.log($(this).text());
			});
			$(document).trigger('showgas');
		},
		showOutput : function () {
			var show = "div#" + GAS.calculator;
			$('.gas-output-area', show).show();
			//GAS.resetAllVars();
		}
	};

//Click handlers.
$('.program-button').click(function(){
	var rel = $(this).attr('rel');
	$('.program-section').hide();
	$('div#' + rel).show();
});
$('a[name="process"]', 'div#gas').click(function () { APP.processGAS(); });
$('a[name="process"]', 'div#gasrev2').click(function () { APP.processgasrev2(); });
$('a[name="reset"]').click(function() { APP.resetGAS(); });
$('a[name="process"]', 'div#ramp').click(function () { APP.processRamp(); });
$('input[name="EMF-check"]').click(function(){
	var inputs = $('input.gasrev2, select.gasrev2');
	if ($(this).is(':checked')) {
		$(inputs).attr('disabled', 'disabled').val('EMF');
	} else {
		$(inputs).removeAttr('disabled').val('');
	}
});

$('input[name="fo2-check"]').click(function(){
	var li = $(this).parents('li');
	if ($(this).is(':checked')){
		$(li).siblings('li.fo2-manual').show();
		$(li).siblings('li.offset-input').hide();
	} else {
		$(li).siblings('li.fo2-manual').hide();
		$(li).siblings('li.offset-input').show();
	}
});

$('button.badmix-stop').click(function (){
	$('.program-section').each(function () {
		if($(this).is('visible')){
			$(this).find('.gas-output-area').empty();
		}
	});
	$(document).trigger('resetall'); 
});

$('button.badmix-go').click(function (){ $(document).trigger('badmixresume'); });

//Custom event bindings.
$(document).bind('resetall', GAS.resetAllVars);
$(document).bind('setmixratio', GAS.setMixRatio);
$(document).bind('makerampdata', GAS.makeRampData);
$(document).bind('validatemixratio', GAS.validateMixRatio);
$(document).bind('badmixratio', GAS.showBadMixError);
$(document).bind('badmixresume', GAS.mixRatioResume);
$(document).bind('parseinput', GAS.parseInput);
$(document).bind('setspecfo2', GAS.setSpecfO2);
$(document).bind('calculatereferencefo2', GAS.calculateReferencefO2);
$(document).bind('calculatespecimenfo2', GAS.calculateSpecimenfO2);
$(document).bind('setemfvars', GAS.setEMFVars);
$(document).bind('calculatedemfdt', GAS.calculatedEMFdT);
$(document).bind('calculatedfo2dfco2', GAS.calculatedfO2dfCO2);
$(document).bind('outputgas', GAS.formatOutput);
$(document).bind('showgas', GAS.showOutput);

//UI Section
$(document).ready(function(){
	$(window).bind("respond", phoneResponse);
	$('.program-section').hide();
	$('li.fo2-manual').hide();
	//$('.program-section:first').show();
	//$('div#ramp, div#gas, div#gasrev2, div#calib3').show();
	//$("div#ramp").show();
	$(window).responsiveWeb({
		applyBodyClasses: true,
		applyResolution: true,
		applyPlatform: false,
		applyBrowser: false,
		applyBrowserVersion: false,
		manipulateDesign: false,
		rearrangeObjects: false,
		debug: false
	}).trigger('respond');
});

function phoneResponse(){
	if($('body').hasClass('phone tablet')){
		$('ul.span4').removeClass('span4');
		$('div.gas-output-area').removeClass('span5');
	}
}
