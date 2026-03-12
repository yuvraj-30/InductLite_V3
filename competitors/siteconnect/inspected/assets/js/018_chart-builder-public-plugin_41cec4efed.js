(function($) {
	'use strict';

	function AysChartPlugin(element, options) {
		this.el = element;
		this.$el = $(element);
		this.htmlClassPrefix = 'ays-chart-';
		this.htmlNamePrefix = 'ays_';
		this.uniqueId;
		this.dbData = undefined;
		this.chartSourceData = undefined;
		this.chartObj = undefined;
		this.chartOptions = null;
		this.chartData = null;
		this.chartTempData = null;
		this.chartType = 'pie_chart';
		this.chartId = null;
	
		this.chartSources = {
			'line_chart'   			: 'Line Chart',
			'bar_chart'    			: 'Bar Chart',
			'pie_chart'    			: 'Pie Chart',
			'column_chart' 			: 'Column Chart',
			'donut_chart'  			: 'Donut Chart',
			'histogram'    			: 'Histogram',
			'geo_chart'    			: 'Geo Chart',
			'org_chart'	   			: 'Org Chart',
			'area_chart'   			: 'Area Chart',
			'gauge_chart'  			: 'Gauge Chart',
			'combo_chart'  			: 'Combo Chart',
			'stepped_area_chart'    : 'Stepped Area Chart',
			'bubble_chart'          : 'Bubble Chart',
			'scatter_chart'         : 'Scatter Chart',
			'table_chart'           : 'Table Chart',
			'timeline_chart'        : 'Timeline Chart',
			'candlestick_chart'     : 'Candlestick Chart',
			'gantt_chart'           : 'Gantt Chart',
			'sankey_diagram'        : 'Sankey Diagram',
			'treemap'               : 'Treemap',
			'word_tree'             : 'Word Tree',
			'3dpie_chart'           : '3D Pie Chart',
		}
	
		this.init();
        this.handleLiveChartUpdate();
	
		return this;
	}
	
	AysChartPlugin.prototype.init = function() {
		var _this = this;
		_this.uniqueId = _this.$el.data('id');

		if ( typeof window.aysChartOptions != 'undefined' ) {
            _this.dbData = JSON.parse( atob( window.aysChartOptions[ _this.uniqueId ] ) );
        }

		_this.setEvents();
	}
	
	AysChartPlugin.prototype.setEvents = function(e){
		var _this = this;
		
		_this.chartId = _this.dbData.id;
		_this.chartType = _this.dbData.chart_type;

		_this.loadChartBySource();
		_this.setClickEventOnExportButtons();

		$(document).on('click', '.elementor-tab-title', function (e) {
			_this.loadChartBySource();
		})
	}

	// Set onclick event on export buttons
	AysChartPlugin.prototype.setClickEventOnExportButtons = function(){
		var _this = this;
		$(document).find(".ays-chart-export-button-" + _this.uniqueId).on("click" , function(e){
			e.preventDefault();
			var buttonVal = $(this).val();
			$(this).attr('data-clicked','true');
			switch (buttonVal){
				case 'print':
					_this.exportOpenChartPrintWindow($(this).parent(),"",_this.uniqueId);
					break;
				case 'image':
					_this.exportOpenChartPrintWindow($(this).parent(),'image',_this.uniqueId);
					break;
				default:
					_this.exportData();
					break;
			}
		});
	}

	// Load charts by given type main function
	AysChartPlugin.prototype.loadChartBySource = function(){
		var _this = this;

		if(typeof _this.chartType !== undefined && _this.chartType){
			switch (_this.chartType) {
				case 'pie_chart':
					_this.pieChartView();
					break;
				case 'bar_chart':
					_this.barChartView();
					break;
				case 'column_chart':
					_this.columnChartView();
					break;
				case 'line_chart':
					_this.lineChartView();
					break;
				case 'donut_chart':
					_this.donutChartView();
					break;
				case 'histogram':
					_this.histogramView();
					break;
				case 'geo_chart':
					_this.geoChartView();
					break;
				case 'org_chart':
					_this.orgChartView();
					break;
				case 'area_chart':
					_this.areaChartView();
					break;
				case 'gauge_chart':
					_this.gaugeChartView();
					break;
				case 'combo_chart':
					_this.comboChartView();
					break;
				case 'stepped_area_chart':
					_this.steppedAreaChartView();
					break;
				case 'bubble_chart':
					_this.bubbleChartView();
					break;
				case 'scatter_chart':
					_this.scatterChartView();
					break;
				case 'table_chart':
					_this.tableChartView();
					break;
				case 'timeline_chart':
					_this.timelineChartView();
					break;
				case 'candlestick_chart':
					_this.candlestickChartView();
					break;
				case 'gantt_chart':
					_this.ganttChartView();
					break;
				case 'sankey_diagram':
					_this.sankeyDiagramView();
					break;
				case 'treemap':
					_this.treemapView();
					break;
				case 'word_tree':
					_this.wordTreeChartView();
					break;
				case '3dpie_chart':
					_this.pie3DChartView();
					break;
				default:
					_this.pieChartView();
					break;
			}
		}
	}

	// Load chart by pie chart
	AysChartPlugin.prototype.pieChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.source;

		var dataTypes = _this.chartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['corechart']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = google.visualization.arrayToDataTable( dataTypes );

			_this.chartOptions = {
				fontSize: nSettings.chartFontSize,
				chartArea: {
					left: nSettings.chartLeftMargin,
					right: nSettings.chartRightMargin,
					top: nSettings.chartTopMargin,
					bottom: nSettings.chartBottomMargin,
				},
				backgroundColor: {
					fill: nSettings.backgroundColor,
					strokeWidth: nSettings.borderWidth,
					stroke: nSettings.borderColor
				},
				enableInteractivity: nSettings.enableInteractivity,
				legend: {
					position: nSettings.legendPosition,
					alignment: nSettings.legendAlignment,
					textStyle: {
						color: nSettings.legendColor,
						fontSize: nSettings.legendFontSize,
						italic: nSettings.legendItalicText,
						bold: nSettings.legendBoldText,
					}
				},
				tooltip: { 
					trigger: nSettings.tooltipTrigger,
					showColorCode: nSettings.showColorCode,
					text: nSettings.tooltipText,
					textStyle: {
						color: nSettings.tooltipTextColor,
						fontSize: nSettings.tooltipFontSize,
						italic: nSettings.tooltipItalicText,
						bold: nSettings.tooltipBoldText,
					}
				},
				pieStartAngle: nSettings.rotationDegree,
				pieSliceBorderColor: nSettings.sliceBorderColor,
				reverseCategories: nSettings.reverseCategories,
				pieSliceText: nSettings.sliceText,
				sliceVisibilityThreshold: nSettings.dataGroupingLimit,
				pieResidueSliceLabel: nSettings.dataGroupingLabel,
				pieResidueSliceColor: nSettings.dataGroupingColor,
				slices: {}
			};

			for (var i = 0; i < dataTypes.length - 1; i++) {
				_this.chartOptions.slices[i] = {
					color: nSettings.sliceColor[i],
					offset: typeof nSettings.sliceOffset[i] !== 'undefined' ? nSettings.sliceOffset[i] : 0,
					textStyle: {
						color: nSettings.sliceTextColor[i],
					},
				}
			}

			_this.chartObj = new google.visualization.PieChart( document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by bar chart
	AysChartPlugin.prototype.barChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.source;
		var dataTypes = _this.multiColumnChartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['corechart']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			dataTypes = nSettings.enableRowSettings ? _this.setRowOptions(dataTypes, nSettings, true) : dataTypes;

			_this.chartData = google.visualization.arrayToDataTable(dataTypes);

			_this.chartOptions = {
				fontSize: nSettings.chartFontSize,
				backgroundColor: {
					fill: nSettings.backgroundColor,
					strokeWidth: nSettings.borderWidth,
					stroke: nSettings.borderColor
				},
				chartArea: {
					backgroundColor: {
						fill: nSettings.chartBackgroundColor,
						stroke: nSettings.chartBorderColor,
						strokeWidth: nSettings.chartBorderWidth
					},
					left: nSettings.chartLeftMargin,
					right: nSettings.chartRightMargin,
					top: nSettings.chartTopMargin,
					bottom: nSettings.chartBottomMargin,
				},
				enableInteractivity: nSettings.enableInteractivity,
				theme: nSettings.maximizedView,
				legend: {
					position: nSettings.legendPosition,
					alignment: nSettings.legendAlignment,
					textStyle: {
						color: nSettings.legendColor,
						fontSize: nSettings.legendFontSize,
						italic: nSettings.legendItalicText,
						bold: nSettings.legendBoldText,
					}
				},
				tooltip: { 
					trigger: nSettings.tooltipTrigger,
					showColorCode: nSettings.showColorCode,
					textStyle: {
						color: nSettings.tooltipTextColor,
						fontSize: nSettings.tooltipFontSize,
						italic: nSettings.tooltipItalicText,
						bold: nSettings.tooltipBoldText,
					}
				},
				hAxis: {
					title: nSettings.hAxisTitle,
					textPosition: nSettings.hAxisTextPosition,
					direction: nSettings.hAxisDirection,
					baselineColor: nSettings.hAxisBaselineColor,
					textStyle: {
						color: nSettings.hAxisTextColor,
						fontSize: nSettings.hAxisTextFontSize,
						italic: nSettings.hAxisItalicText,
						bold: nSettings.hAxisBoldText,
					},
					slantedText: nSettings.hAxisSlantedText,
					slantedTextAngle: nSettings.hAxisSlantedTextAngle,
					format: nSettings.hAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.hAxisLabelFontSize,
						color: nSettings.hAxisLabelColor,
						italic: nSettings.hAxisItalicTitle,
						bold: nSettings.hAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.hAxisMinValue,
						max: nSettings.hAxisMaxValue,
					},
					gridlines: {
						count: nSettings.hAxisGridlinesCount,
						color: nSettings.hAxisGridlinesColor,
					},
					minorGridlines: {
						color: nSettings.hAxisMinorGridlinesColor,
					},
				},
				vAxis: {
					title: nSettings.vAxisTitle,
					textPosition: nSettings.vAxisTextPosition,
					direction: nSettings.vAxisDirection,
					baselineColor: nSettings.vAxisBaselineColor,
					textStyle: {
						color: nSettings.vAxisTextColor,
						fontSize: nSettings.vAxisTextFontSize,
						italic: nSettings.vAxisItalicText,
						bold: nSettings.vAxisBoldText,
					},
					format: nSettings.vAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.vAxisLabelFontSize,
						color: nSettings.vAxisLabelColor,
						italic: nSettings.vAxisItalicTitle,
						bold: nSettings.vAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.vAxisMinValue,
						max: nSettings.vAxisMaxValue,
					},
					gridlines: {
						count: nSettings.vAxisGridlinesCount,
						color: nSettings.vAxisGridlinesColor,
					},
					minorGridlines: {
						color: nSettings.vAxisMinorGridlinesColor,
					},
				},
				focusTarget: nSettings.focusTarget,
				isStacked: nSettings.isStacked,
				dataOpacity: nSettings.opacity,
				bar: {
					groupWidth: nSettings.groupWidth
				},
				series: {},
			};

			for (var i = 0; i < dataTypes.length - 1; i++) {
				_this.chartOptions.series[i] = {
					color: nSettings.seriesColor[i],
					visibleInLegend: nSettings.seriesVisibleInLegend[i] == 'on' ? true : (typeof nSettings.seriesColor[i] !== 'undefined' ? false : true),
				}
			}

			if (nSettings.enableAnimation) {
				_this.chartOptions.animation = {
					startup: nSettings.animationStartup,
					duration: nSettings.animationDuration,
					easing: nSettings.animationEasing,
				}
			}

			_this.chartObj = new google.visualization.BarChart(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by column chart
	AysChartPlugin.prototype.columnChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.source;

		// Collect data in new array for chart rendering (Column chart)
		var dataTypes = _this.multiColumnChartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['corechart']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			dataTypes = nSettings.enableRowSettings ? _this.setRowOptions(dataTypes, nSettings, true) : dataTypes;

			_this.chartData = google.visualization.arrayToDataTable(dataTypes);

			_this.chartOptions = {
				fontSize: nSettings.chartFontSize,
				backgroundColor: {
					fill: nSettings.backgroundColor,
					strokeWidth: nSettings.borderWidth,
					stroke: nSettings.borderColor
				},
				chartArea: {
					backgroundColor: {
						fill: nSettings.chartBackgroundColor,
						stroke: nSettings.chartBorderColor,
						strokeWidth: nSettings.chartBorderWidth
					},
					left: nSettings.chartLeftMargin,
					right: nSettings.chartRightMargin,
					top: nSettings.chartTopMargin,
					bottom: nSettings.chartBottomMargin,
				},
				enableInteractivity: nSettings.enableInteractivity,
				theme: nSettings.maximizedView,
				legend: {
					position: nSettings.legendPosition,
					alignment: nSettings.legendAlignment,
					textStyle: {
						color: nSettings.legendColor,
						fontSize: nSettings.legendFontSize,
						italic: nSettings.legendItalicText,
						bold: nSettings.legendBoldText,
					}
				},
				tooltip: { 
					trigger: nSettings.tooltipTrigger,
					showColorCode: nSettings.showColorCode,
					textStyle: {
						color: nSettings.tooltipTextColor,
						fontSize: nSettings.tooltipFontSize,
						italic: nSettings.tooltipItalicText,
						bold: nSettings.tooltipBoldText,
					}
				},
				hAxis: {
					title: nSettings.hAxisTitle,
					textPosition: nSettings.hAxisTextPosition,
					direction: nSettings.hAxisDirection,
					baselineColor: nSettings.hAxisBaselineColor,
					textStyle: {
						color: nSettings.hAxisTextColor,
						fontSize: nSettings.hAxisTextFontSize,
						italic: nSettings.hAxisItalicText,
						bold: nSettings.hAxisBoldText,
					},
					slantedText: nSettings.hAxisSlantedText,
					slantedTextAngle: nSettings.hAxisSlantedTextAngle,
					format: nSettings.hAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.hAxisLabelFontSize,
						color: nSettings.hAxisLabelColor,
						italic: nSettings.hAxisItalicTitle,
						bold: nSettings.hAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.hAxisMinValue,
						max: nSettings.hAxisMaxValue,
					},
					gridlines: {
						count: nSettings.hAxisGridlinesCount,
						color: nSettings.hAxisGridlinesColor,
					},
					minorGridlines: {
						color: nSettings.hAxisMinorGridlinesColor,
					},
					showTextEvery: nSettings.hAxisShowTextEvery
				},
				vAxis: {
					title: nSettings.vAxisTitle,
					textPosition: nSettings.vAxisTextPosition,
					direction: nSettings.vAxisDirection,
					baselineColor: nSettings.vAxisBaselineColor,
					textStyle: {
						color: nSettings.vAxisTextColor,
						fontSize: nSettings.vAxisTextFontSize,
						italic: nSettings.vAxisItalicText,
						bold: nSettings.vAxisBoldText,
					},
					format: nSettings.vAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.vAxisLabelFontSize,
						color: nSettings.vAxisLabelColor,
						italic: nSettings.vAxisItalicTitle,
						bold: nSettings.vAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.vAxisMinValue,
						max: nSettings.vAxisMaxValue,
					},
					gridlines: {
						count: nSettings.vAxisGridlinesCount,
						color: nSettings.vAxisGridlinesColor,
					},
					minorGridlines: {
						color: nSettings.vAxisMinorGridlinesColor,
					},
				},
				focusTarget: nSettings.focusTarget,
				isStacked: nSettings.isStacked,
				dataOpacity: nSettings.opacity,
				bar: {
					groupWidth: nSettings.groupWidth
				},
				series: {},
			};

			for (var i = 0; i < dataTypes.length - 1; i++) {
				_this.chartOptions.series[i] = {
					color: nSettings.seriesColor[i],
					visibleInLegend: nSettings.seriesVisibleInLegend[i] == 'on' ? true : (typeof nSettings.seriesColor[i] !== 'undefined' ? false : true),
				}
			}

			if (nSettings.enableAnimation) {
				_this.chartOptions.animation = {
					startup: nSettings.animationStartup,
					duration: nSettings.animationDuration,
					easing: nSettings.animationEasing,
				}
			}

			_this.chartObj = new google.visualization.ColumnChart(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by line chart
	AysChartPlugin.prototype.lineChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.source;
		var dataTypes = _this.multiColumnChartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['corechart']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			dataTypes = nSettings.enableRowSettings ? _this.setRowOptions(dataTypes, nSettings, true) : dataTypes;

			_this.chartData = google.visualization.arrayToDataTable(dataTypes);

			_this.chartOptions = {
				fontSize: nSettings.chartFontSize,
				backgroundColor: {
					fill: nSettings.backgroundColor,
					strokeWidth: nSettings.borderWidth,
					stroke: nSettings.borderColor
				},
				chartArea: {
					backgroundColor: {
						fill: nSettings.chartBackgroundColor,
						stroke: nSettings.chartBorderColor,
						strokeWidth: nSettings.chartBorderWidth
					},
					left: nSettings.chartLeftMargin,
					right: nSettings.chartRightMargin,
					top: nSettings.chartTopMargin,
					bottom: nSettings.chartBottomMargin,
				},
				enableInteractivity: nSettings.enableInteractivity,
				theme: nSettings.maximizedView,
				legend: {
					position: nSettings.legendPosition,
					alignment: nSettings.legendAlignment,
					textStyle: {
						color: nSettings.legendColor,
						fontSize: nSettings.legendFontSize,
						italic: nSettings.legendItalicText,
						bold: nSettings.legendBoldText,
					}
				},
				tooltip: { 
					trigger: nSettings.tooltipTrigger,
					showColorCode: nSettings.showColorCode,
					textStyle: {
						color: nSettings.tooltipTextColor,
						fontSize: nSettings.tooltipFontSize,
						italic: nSettings.tooltipItalicText,
						bold: nSettings.tooltipBoldText,
					}
				},
				hAxis: {
					title: nSettings.hAxisTitle,
					textPosition: nSettings.hAxisTextPosition,
					direction: nSettings.hAxisDirection,
					baselineColor: nSettings.hAxisBaselineColor,
					textStyle: {
						color: nSettings.hAxisTextColor,
						fontSize: nSettings.hAxisTextFontSize,
						italic: nSettings.hAxisItalicText,
						bold: nSettings.hAxisBoldText,
					},
					slantedText: nSettings.hAxisSlantedText,
					slantedTextAngle: nSettings.hAxisSlantedTextAngle,
					format: nSettings.hAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.hAxisLabelFontSize,
						color: nSettings.hAxisLabelColor,
						italic: nSettings.hAxisItalicTitle,
						bold: nSettings.hAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.hAxisMinValue,
						max: nSettings.hAxisMaxValue,
					},
					gridlines: {
						count: nSettings.hAxisGridlinesCount,
						color: nSettings.hAxisGridlinesColor,
					},
					minorGridlines: {
						color: nSettings.hAxisMinorGridlinesColor,
					},
					showTextEvery: nSettings.hAxisShowTextEvery
				},
				vAxis: {
					title: nSettings.vAxisTitle,
					textPosition: nSettings.vAxisTextPosition,
					direction: nSettings.vAxisDirection,
					baselineColor: nSettings.vAxisBaselineColor,
					textStyle: {
						color: nSettings.vAxisTextColor,
						fontSize: nSettings.vAxisTextFontSize,
						italic: nSettings.vAxisItalicText,
						bold: nSettings.vAxisBoldText,
					},
					format: nSettings.vAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.vAxisLabelFontSize,
						color: nSettings.vAxisLabelColor,
						italic: nSettings.vAxisItalicTitle,
						bold: nSettings.vAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.vAxisMinValue,
						max: nSettings.vAxisMaxValue,
					},
					gridlines: {
						count: nSettings.vAxisGridlinesCount,
						color: nSettings.vAxisGridlinesColor,
					},
					minorGridlines: {
						color: nSettings.vAxisMinorGridlinesColor,
					},
				},
				crosshair: {
					opacity: nSettings.crosshairOpacity,
					orientation: nSettings.crosshairOrientation,
					trigger: nSettings.crosshairTrigger,
				},
				focusTarget: nSettings.focusTarget,
				dataOpacity: nSettings.opacity,
				lineWidth: nSettings.lineWidth,
				selectionMode: nSettings.multipleSelection,
				aggregationTarget: nSettings.multipleDataFormat,
				pointShape: nSettings.pointShape,
				pointSize: nSettings.pointSize,
				orientation: nSettings.orientation,
				interpolateNulls: nSettings.fillNulls,
				curveType: nSettings.curveType,
				series: {},
			};

			for (var i = 0; i < dataTypes.length - 1; i++) {
				_this.chartOptions.series[i] = {
					color: nSettings.seriesColor[i],
					visibleInLegend: nSettings.seriesVisibleInLegend[i] == 'on' ? true : (typeof nSettings.seriesColor[i] !== 'undefined' ? false : true),
				}
			}

			if (nSettings.enableAnimation) {
				_this.chartOptions.animation = {
					startup: nSettings.animationStartup,
					duration: nSettings.animationDuration,
					easing: nSettings.animationEasing,
				}
			}

			_this.chartObj = new google.visualization.LineChart(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by donut chart
	AysChartPlugin.prototype.donutChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.source;

		var dataTypes = _this.chartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['corechart']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = google.visualization.arrayToDataTable( dataTypes );

			_this.chartOptions = {
				fontSize: nSettings.chartFontSize,
				chartArea: {
					left: nSettings.chartLeftMargin,
					right: nSettings.chartRightMargin,
					top: nSettings.chartTopMargin,
					bottom: nSettings.chartBottomMargin,
				},
				backgroundColor: {
					fill: nSettings.backgroundColor,
					strokeWidth: nSettings.borderWidth,
					stroke: nSettings.borderColor
				},
				enableInteractivity: nSettings.enableInteractivity,
				legend: {
					position: nSettings.legendPosition,
					alignment: nSettings.legendAlignment,
					textStyle: {
						color: nSettings.legendColor,
						fontSize: nSettings.legendFontSize,
						italic: nSettings.legendItalicText,
						bold: nSettings.legendBoldText,
					}
				},
				tooltip: { 
					trigger: nSettings.tooltipTrigger,
					showColorCode: nSettings.showColorCode,
					text: nSettings.tooltipText,
					textStyle: {
						color: nSettings.tooltipTextColor,
						fontSize: nSettings.tooltipFontSize,
						italic: nSettings.tooltipItalicText,
						bold: nSettings.tooltipBoldText,
					}
				},
				pieStartAngle: nSettings.rotationDegree,
				pieSliceBorderColor: nSettings.sliceBorderColor,
				reverseCategories: nSettings.reverseCategories,
				pieSliceText: nSettings.sliceText,
				sliceVisibilityThreshold: nSettings.dataGroupingLimit/100,
				pieResidueSliceLabel: nSettings.dataGroupingLabel,
				pieResidueSliceColor: nSettings.dataGroupingColor,
				pieHole: nSettings.holeSize,
				slices: {}
			};

			for (var i = 0; i < dataTypes.length - 1; i++) {
				_this.chartOptions.slices[i] = {
					color: nSettings.sliceColor[i],
					offset: typeof nSettings.sliceOffset[i] !== 'undefined' ? nSettings.sliceOffset[i] : 0,
					textStyle: {
						color: nSettings.sliceTextColor[i],
					},
				}
			}

			_this.chartObj = new google.visualization.PieChart( document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId) );

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by histogram
	AysChartPlugin.prototype.histogramView = function(){
		var _this = this;
		var getChartSource = _this.dbData.source;
		var dataTypes = _this.chartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['corechart']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = google.visualization.arrayToDataTable(dataTypes);

			_this.chartOptions = {
				fontSize: nSettings.chartFontSize,
				backgroundColor: {
					fill: nSettings.backgroundColor,
					strokeWidth: nSettings.borderWidth,
					stroke: nSettings.borderColor
				},
				chartArea: {
					backgroundColor: {
						fill: nSettings.chartBackgroundColor,
						stroke: nSettings.chartBorderColor,
						strokeWidth: nSettings.chartBorderWidth
					},
					left: nSettings.chartLeftMargin,
					right: nSettings.chartRightMargin,
					top: nSettings.chartTopMargin,
					bottom: nSettings.chartBottomMargin,
				},
				enableInteractivity: nSettings.enableInteractivity,
				theme: nSettings.maximizedView,
				legend: {
					position: nSettings.legendPosition,
					alignment: nSettings.legendAlignment,
					textStyle: {
						color: nSettings.legendColor,
						fontSize: nSettings.legendFontSize,
						italic: nSettings.legendItalicText,
						bold: nSettings.legendBoldText,
					}
				},
				tooltip: { 
					trigger: nSettings.tooltipTrigger,
					showColorCode: nSettings.showColorCode,
					textStyle: {
						color: nSettings.tooltipTextColor,
						fontSize: nSettings.tooltipFontSize,
						italic: nSettings.tooltipItalicText,
						bold: nSettings.tooltipBoldText,
					}
				},
				hAxis: {
					title: nSettings.hAxisTitle,
					textPosition: nSettings.hAxisTextPosition,
					textStyle: {
						color: nSettings.hAxisTextColor,
						fontSize: nSettings.hAxisTextFontSize,
						italic :nSettings.hAxisItalicText,
						bold: nSettings.hAxisBoldText,
					},
					slantedText: nSettings.hAxisSlantedText,
					slantedTextAngle: nSettings.hAxisSlantedTextAngle,
					format: nSettings.hAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.hAxisLabelFontSize,
						color: nSettings.hAxisLabelColor,
						italic: nSettings.hAxisItalicTitle,
						bold: nSettings.hAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.hAxisMinValue,
						max: nSettings.hAxisMaxValue,
					},
					gridlines: {
						count: nSettings.hAxisGridlinesCount,
						color: nSettings.hAxisGridlinesColor,
					},
				},
				vAxis: {
					title: nSettings.vAxisTitle,
					textPosition: nSettings.vAxisTextPosition,
					textStyle: {
						color: nSettings.vAxisTextColor,
						fontSize: nSettings.vAxisTextFontSize,
						italic: nSettings.vAxisItalicText,
						bold: nSettings.vAxisBoldText,
					},
					format: nSettings.vAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.vAxisLabelFontSize,
						color: nSettings.vAxisLabelColor,
						italic: nSettings.vAxisItalicTitle,
						bold: nSettings.vAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.vAxisMinValue,
						max: nSettings.vAxisMaxValue,
					},
					gridlines: {
						count: nSettings.vAxisGridlinesCount,
						color: nSettings.vAxisGridlinesColor,
					},
				},
				dataOpacity: nSettings.opacity,
				bar: {
					groupWidth: nSettings.groupWidth
				},
			};

			_this.chartObj = new google.visualization.Histogram(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by geo chart
	AysChartPlugin.prototype.geoChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.source;

		var dataTypes = _this.chartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		var enableUrl = (settings['enable_url'] == 'on') ? true : false;

		/* == Google part == */
		google.charts.load('current', {'packages':['corechart']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = google.visualization.arrayToDataTable( dataTypes );

			var view = new google.visualization.DataView(_this.chartData);
    		view.setColumns([0, 1]);

			_this.chartOptions = {
				backgroundColor: {
					fill: nSettings.backgroundColor,
					strokeWidth: nSettings.borderWidth,
					stroke: nSettings.borderColor
				},
				fontSize: nSettings.chartFontSize,
				tooltip: { 
					trigger: nSettings.tooltipTrigger,
					textStyle: {
						color: nSettings.tooltipTextColor,
						fontSize: nSettings.tooltipFontSize,
						italic: nSettings.tooltipItalicText,
						bold: nSettings.tooltipBoldText,
					}
				},
				enableRegionInteractivity: nSettings.enableInteractivity,
				keepAspectRatio: nSettings.keepAspectRatio,
			};

			_this.chartObj = new google.visualization.GeoChart( document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId) );

			google.visualization.events.addListener(_this.chartObj, 'select', function () {
				if (enableUrl) {
					var selection = _this.chartObj.getSelection();
					if (selection.length > 0) {
						if (_this.chartData.getValue(selection[0].row, 2) != '') {
							window.open(_this.chartData.getValue(selection[0].row, 2), '_blank');
						}
					}
				}
			});

			_this.chartObj.draw( view, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by org chart
	AysChartPlugin.prototype.orgChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.source;
		var dataTypes = _this.orgChartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['orgchart']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = new google.visualization.arrayToDataTable(dataTypes);

			var view = new google.visualization.DataView(_this.chartData);
    		view.setColumns([0, 1, 2]);

			_this.chartOptions = {
				allowHtml: true,
				size: nSettings.orgChartFontSize,
				allowCollapse: nSettings.allowCollapse,
				nodeClass: nSettings.orgClassname,
			};

			_this.chartObj = new google.visualization.OrgChart(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			google.visualization.events.addListener(_this.chartObj, 'select', function () {
				var selection = _this.chartObj.getSelection();
				if (selection.length > 0) {
					if (_this.chartData.getValue(selection[0].row, 3) != '') {
						window.open(_this.chartData.getValue(selection[0].row, 3), '_blank');
					}
				}
			});
			
			google.visualization.events.addListener(_this.chartObj, 'collapse', function () {
				_this.setOrgChartCustomStyles();
			});

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
			_this.setOrgChartCustomStyles();
		}
		/* */
	}

	// Load chart by line chart
	AysChartPlugin.prototype.areaChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.source;
		var dataTypes = _this.multiColumnChartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['corechart']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {			
			_this.chartData = google.visualization.arrayToDataTable(dataTypes);

			_this.chartOptions = {
				fontSize: nSettings.chartFontSize,
				backgroundColor: {
					fill: nSettings.backgroundColor,
					strokeWidth: nSettings.borderWidth,
					stroke: nSettings.borderColor
				},
				chartArea: {
					backgroundColor: {
						fill: nSettings.chartBackgroundColor,
						stroke: nSettings.chartBorderColor,
						strokeWidth: nSettings.chartBorderWidth
					},
					left: nSettings.chartLeftMargin,
					right: nSettings.chartRightMargin,
					top: nSettings.chartTopMargin,
					bottom: nSettings.chartBottomMargin,
				},
				enableInteractivity: nSettings.enableInteractivity,
				theme: nSettings.maximizedView,
				legend: {
					position: nSettings.legendPosition,
					alignment: nSettings.legendAlignment,
					textStyle: {
						color: nSettings.legendColor,
						fontSize: nSettings.legendFontSize,
						italic: nSettings.legendItalicText,
						bold: nSettings.legendBoldText,
					}
				},
				tooltip: { 
					trigger: nSettings.tooltipTrigger,
					showColorCode: nSettings.showColorCode,
					textStyle: {
						color: nSettings.tooltipTextColor,
						fontSize: nSettings.tooltipFontSize,
						italic: nSettings.tooltipItalicText,
						bold: nSettings.tooltipBoldText,
					}
				},
				hAxis: {
					title: nSettings.hAxisTitle,
					textPosition: nSettings.hAxisTextPosition,
					direction: nSettings.hAxisDirection,
					textStyle: {
						color: nSettings.hAxisTextColor,
						fontSize: nSettings.hAxisTextFontSize,
						italic: nSettings.hAxisItalicText,
						bold: nSettings.hAxisBoldText,
					},
					slantedText: nSettings.hAxisSlantedText,
					slantedTextAngle: nSettings.hAxisSlantedTextAngle,
					format: nSettings.hAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.hAxisLabelFontSize,
						color: nSettings.hAxisLabelColor,
						italic: nSettings.hAxisItalicTitle,
						bold: nSettings.hAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.hAxisMinValue,
						max: nSettings.hAxisMaxValue,
					},
					gridlines: {
						count: nSettings.hAxisGridlinesCount,
						color: nSettings.hAxisGridlinesColor,
					},
				},
				vAxis: {
					title: nSettings.vAxisTitle,
					textPosition: nSettings.vAxisTextPosition,
					direction: nSettings.vAxisDirection,
					textStyle: {
						color: nSettings.vAxisTextColor,
						fontSize: nSettings.vAxisTextFontSize,
						italic: nSettings.vAxisItalicText,
						bold: nSettings.vAxisBoldText,
					},
					format: nSettings.vAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.vAxisLabelFontSize,
						color: nSettings.vAxisLabelColor,
						italic: nSettings.vAxisItalicTitle,
						bold: nSettings.vAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.vAxisMinValue,
						max: nSettings.vAxisMaxValue,
					},
					gridlines: {
						count: nSettings.vAxisGridlinesCount,
						color: nSettings.vAxisGridlinesColor,
					},
				},
				crosshair: {
					opacity: nSettings.crosshairOpacity,
					orientation: nSettings.crosshairOrientation,
					trigger: nSettings.crosshairTrigger,
				},
				focusTarget: nSettings.focusTarget,
				dataOpacity: nSettings.opacity,
				lineWidth: nSettings.lineWidth,
				selectionMode: nSettings.multipleSelection,
				aggregationTarget: nSettings.multipleDataFormat,
				pointShape: nSettings.pointShape,
				pointSize: nSettings.pointSize,
				curveType: nSettings.curveType,
				orientation: nSettings.orientation,
				interpolateNulls: nSettings.fillNulls,
				series: {},
			};

			for (var i = 0; i < dataTypes.length - 1; i++) {
				_this.chartOptions.series[i] = {
					color: nSettings.seriesColor[i],
					visibleInLegend: nSettings.seriesVisibleInLegend[i] == 'on' ? true : (typeof nSettings.seriesColor[i] !== 'undefined' ? false : true),
				}
			}

			if (nSettings.enableAnimation) {
				_this.chartOptions.animation = {
					startup: nSettings.animationStartup,
					duration: nSettings.animationDuration,
        			easing: nSettings.animationEasing,
				}
			}

			_this.chartObj = new google.visualization.AreaChart(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by gauge chart
	AysChartPlugin.prototype.gaugeChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.source;
		var dataTypes = _this.chartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['gauge']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = google.visualization.arrayToDataTable(dataTypes);

			_this.chartOptions = {
				minorTicks: nSettings.minorTicks,
			};

			_this.chartObj = new google.visualization.Gauge(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by combo chart
	AysChartPlugin.prototype.comboChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.source;
		var dataTypes = _this.multiColumnChartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['corechart']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			dataTypes = nSettings.enableRowSettings ? _this.setRowOptions(dataTypes, nSettings, true) : dataTypes;
			
			_this.chartData = google.visualization.arrayToDataTable(dataTypes);

			_this.chartOptions = {
				type: 'line',
				fontSize: nSettings.chartFontSize,
				backgroundColor: {
					fill: nSettings.backgroundColor,
					strokeWidth: nSettings.borderWidth,
					stroke: nSettings.borderColor
				},
				chartArea: {
					backgroundColor: {
						fill: nSettings.chartBackgroundColor,
						stroke: nSettings.chartBorderColor,
						strokeWidth: nSettings.chartBorderWidth
					},
					left: nSettings.chartLeftMargin,
					right: nSettings.chartRightMargin,
					top: nSettings.chartTopMargin,
					bottom: nSettings.chartBottomMargin,
				},
				enableInteractivity: nSettings.enableInteractivity,
				theme: nSettings.maximizedView,
				legend: {
					position: nSettings.legendPosition,
					alignment: nSettings.legendAlignment,
					textStyle: {
						color: nSettings.legendColor,
						fontSize: nSettings.legendFontSize,
						italic: nSettings.legendItalicText,
						bold: nSettings.legendBoldText,
					}
				},
				tooltip: { 
					trigger: nSettings.tooltipTrigger,
					showColorCode: nSettings.showColorCode,
					textStyle: {
						color: nSettings.tooltipTextColor,
						fontSize: nSettings.tooltipFontSize,
						italic: nSettings.tooltipItalicText,
						bold: nSettings.tooltipBoldText,
					}
				},
				hAxis: {
					title: nSettings.hAxisTitle,
					textPosition: nSettings.hAxisTextPosition,
					direction: nSettings.hAxisDirection,
					textStyle: {
						color: nSettings.hAxisTextColor,
						fontSize: nSettings.hAxisTextFontSize,
						italic: nSettings.hAxisItalicText,
						bold: nSettings.hAxisBoldText,
					},
					slantedText: nSettings.hAxisSlantedText,
					slantedTextAngle: nSettings.hAxisSlantedTextAngle,
					format: nSettings.hAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.hAxisLabelFontSize,
						color: nSettings.hAxisLabelColor,
						italic: nSettings.hAxisItalicTitle,
						bold: nSettings.hAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.hAxisMinValue,
						max: nSettings.hAxisMaxValue,
					},
					gridlines: {
						count: nSettings.hAxisGridlinesCount,
						color: nSettings.hAxisGridlinesColor,
					},
				},
				vAxis: {
					title: nSettings.vAxisTitle,
					textPosition: nSettings.vAxisTextPosition,
					direction: nSettings.vAxisDirection,
					textStyle: {
						color: nSettings.vAxisTextColor,
						fontSize: nSettings.vAxisTextFontSize,
						italic: nSettings.vAxisItalicText,
						bold: nSettings.vAxisBoldText,
					},
					format: nSettings.vAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.vAxisLabelFontSize,
						color: nSettings.vAxisLabelColor,
						italic: nSettings.vAxisItalicTitle,
						bold: nSettings.vAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.vAxisMinValue,
						max: nSettings.vAxisMaxValue,
					},
					gridlines: {
						count: nSettings.vAxisGridlinesCount,
						color: nSettings.vAxisGridlinesColor,
					},
				},
				crosshair: {
					opacity: nSettings.crosshairOpacity,
					orientation: nSettings.crosshairOrientation,
					trigger: nSettings.crosshairTrigger,
				},
				focusTarget: nSettings.focusTarget,
				dataOpacity: nSettings.opacity,
				lineWidth: nSettings.lineWidth,
				selectionMode: nSettings.multipleSelection,
				aggregationTarget: nSettings.multipleDataFormat,
				pointShape: nSettings.pointShape,
				pointSize: nSettings.pointSize,
				curveType: nSettings.curveType,
				series: {},
			};

			for (var i = 0; i < dataTypes.length - 1; i++) {
				_this.chartOptions.series[i] = {
					color: nSettings.seriesColor[i],
					visibleInLegend: nSettings.seriesVisibleInLegend[i] == 'on' ? true : (typeof nSettings.seriesColor[i] !== 'undefined' ? false : true),
					type: typeof nSettings.comboType[i] !== 'undefined' ? nSettings.comboType[i] : 'line',
				}
			}

			if (nSettings.enableAnimation) {
				_this.chartOptions.animation = {
					startup: nSettings.animationStartup,
					duration: nSettings.animationDuration,
        			easing: nSettings.animationEasing,
				}
			}

			_this.chartObj = new google.visualization.ComboChart(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by stepped area chart
	AysChartPlugin.prototype.steppedAreaChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.source;
		var dataTypes = _this.multiColumnChartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['corechart']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = google.visualization.arrayToDataTable(dataTypes);

			_this.chartOptions = {
				enableInteractivity: nSettings.enableInteractivity,
				fontSize: nSettings.chartFontSize,
				backgroundColor: {
					fill: nSettings.backgroundColor,
					strokeWidth: nSettings.borderWidth,
					stroke: nSettings.borderColor
				},
				chartArea: {
					backgroundColor: {
						fill: nSettings.chartBackgroundColor,
						stroke: nSettings.chartBorderColor,
						strokeWidth: nSettings.chartBorderWidth
					},
					left: nSettings.chartLeftMargin,
					right: nSettings.chartRightMargin,
					top: nSettings.chartTopMargin,
					bottom: nSettings.chartBottomMargin,
				},
				theme: nSettings.maximizedView,
				legend: {
					position: nSettings.legendPosition,
					alignment: nSettings.legendAlignment,
					textStyle: {
						color: nSettings.legendColor,
						fontSize: nSettings.legendFontSize,
						italic: nSettings.legendItalicText,
						bold: nSettings.legendBoldText,
					}
				},
				tooltip: { 
					trigger: nSettings.tooltipTrigger,
					showColorCode: nSettings.showColorCode,
					textStyle: {
						color: nSettings.tooltipTextColor,
						fontSize: nSettings.tooltipFontSize,
						italic: nSettings.tooltipItalicText,
						bold: nSettings.tooltipBoldText,
					}
				},
				hAxis: {
					title: nSettings.hAxisTitle,
					textPosition: nSettings.hAxisTextPosition,
					direction: nSettings.hAxisDirection,
					textStyle: {
						color: nSettings.hAxisTextColor,
						fontSize: nSettings.hAxisTextFontSize,
						italic: nSettings.hAxisItalicText,
						bold: nSettings.hAxisBoldText,
					},
					slantedText: nSettings.hAxisSlantedText,
					slantedTextAngle: nSettings.hAxisSlantedTextAngle,
					format: nSettings.hAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.hAxisLabelFontSize,
						color: nSettings.hAxisLabelColor,
						italic: nSettings.hAxisItalicTitle,
						bold: nSettings.hAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.hAxisMinValue,
						max: nSettings.hAxisMaxValue,
					},
					gridlines: {
						count: nSettings.hAxisGridlinesCount,
						color: nSettings.hAxisGridlinesColor,
					},
				},
				vAxis: {
					title: nSettings.vAxisTitle,
					textPosition: nSettings.vAxisTextPosition,
					direction: nSettings.vAxisDirection,
					textStyle: {
						color: nSettings.vAxisTextColor,
						fontSize: nSettings.vAxisTextFontSize,
						italic: nSettings.vAxisItalicText,
						bold: nSettings.vAxisBoldText,
					},
					format: nSettings.vAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.vAxisLabelFontSize,
						color: nSettings.vAxisLabelColor,
						italic: nSettings.vAxisItalicTitle,
						bold: nSettings.vAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.vAxisMinValue,
						max: nSettings.vAxisMaxValue,
					},
					gridlines: {
						count: nSettings.vAxisGridlinesCount,
						color: nSettings.vAxisGridlinesColor,
					},
				},
				focusTarget: nSettings.focusTarget,
				lineWidth: nSettings.lineWidth,
				selectionMode: nSettings.multipleSelection,
				aggregationTarget: nSettings.multipleDataFormat,
				series: {},
			};

			for (var i = 0; i < dataTypes.length - 1; i++) {
				_this.chartOptions.series[i] = {
					color: nSettings.seriesColor[i],
					visibleInLegend: nSettings.seriesVisibleInLegend[i] == 'on' ? true : (typeof nSettings.seriesColor[i] !== 'undefined' ? false : true),
				}
			}

			if (nSettings.enableAnimation) {
				_this.chartOptions.animation = {
					startup: nSettings.animationStartup,
					duration: nSettings.animationDuration,
        			easing: nSettings.animationEasing,
				}
			}

			_this.chartObj = new google.visualization.SteppedAreaChart(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by bubble chart
	AysChartPlugin.prototype.bubbleChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.chart_data_by_types[_this.chartType] != undefined ? _this.dbData.chart_data_by_types[_this.chartType] : _this.dbData.source;
		var dataTypes = _this.bubbleChartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);
		
		/* == Google part == */
		google.charts.load('current', {'packages':['corechart']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = google.visualization.arrayToDataTable(dataTypes);

			_this.chartOptions = {
				enableInteractivity: nSettings.enableInteractivity,
				fontSize: nSettings.chartFontSize,
				backgroundColor: {
					fill: nSettings.backgroundColor,
					strokeWidth: nSettings.borderWidth,
					stroke: nSettings.borderColor
				},
				chartArea: {
					backgroundColor: {
						fill: nSettings.hartBackgroundColor,
						stroke: nSettings.chartBorderColor,
						strokeWidth: nSettings.chartBorderWidth
					},
					left: nSettings.chartLeftMargin,
					right: nSettings.chartRightMargin,
					top: nSettings.chartTopMargin,
					bottom: nSettings.chartBottomMargin,
				},
				theme: nSettings.maximizedView,
				legend: {
					position: nSettings.legendPosition,
					alignment: nSettings.legendAlignment,
					textStyle: {
						color: nSettings.legendColor,
						fontSize: nSettings.legendFontSize,
						italic: nSettings.legendItalicText,
						bold: nSettings.legendBoldText,
					}
				},
				tooltip: { 
					trigger: nSettings.tooltipTrigger,
					showColorCode: nSettings.showColorCode,
					textStyle: {
						color: nSettings.tooltipTextColor,
						fontSize: nSettings.tooltipFontSize,
						italic: nSettings.tooltipItalicText,
						bold: nSettings.tooltipBoldText,
					}
				},
				hAxis: {
					title: nSettings.hAxisTitle,
					textPosition: nSettings.hAxisTextPosition,
					direction: nSettings.hAxisDirection,
					textStyle: {
						color: nSettings.hAxisTextColor,
						fontSize: nSettings.hAxisTextFontSize,
						italic: nSettings.hAxisItalicText,
						bold: nSettings.hAxisBoldText,
					},
					slantedText: nSettings.hAxisSlantedText,
					slantedTextAngle: nSettings.hAxisSlantedTextAngle,
					format: nSettings.hAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.hAxisLabelFontSize,
						color: nSettings.hAxisLabelColor,
						italic: nSettings.hAxisItalicTitle,
						bold: nSettings.hAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.hAxisMinValue,
						max: nSettings.hAxisMaxValue,
					},
					gridlines: {
						count: nSettings.hAxisGridlinesCount,
						color: nSettings.hAxisGridlinesColor,
					},
				},
				vAxis: {
					title: nSettings.vAxisTitle,
					textPosition: nSettings.vAxisTextPosition,
					direction: nSettings.vAxisDirection,
					textStyle: {
						color: nSettings.vAxisTextColor,
						fontSize: nSettings.vAxisTextFontSize,
						italic: nSettings.vAxisItalicText,
						bold: nSettings.vAxisBoldText,
					},
					format: nSettings.vAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.vAxisLabelFontSize,
						color: nSettings.vAxisLabelColor,
						italic: nSettings.vAxisItalicTitle,
						bold: nSettings.vAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.vAxisMinValue,
						max: nSettings.vAxisMaxValue,
					},
					gridlines: {
						count: nSettings.vAxisGridlinesCount,
						color: nSettings.vAxisGridlinesColor,
					},
				},
				bubble: {
					opacity: nSettings.opacity
				},
				selectionMode: nSettings.multipleSelection,
			};

			if (nSettings.enableAnimation) {
				_this.chartOptions.animation = {
					startup: nSettings.animationStartup,
					duration: nSettings.animationDuration,
        			easing: nSettings.animationEasing,
				}
			}

			_this.chartObj = new google.visualization.BubbleChart(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}
	
	// Load chart by scatter chart
	AysChartPlugin.prototype.scatterChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.chart_data_by_types[_this.chartType] != undefined ? _this.dbData.chart_data_by_types[_this.chartType] : _this.dbData.source;

		var dataTypes = _this.scatterChartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);
		
		/* == Google part == */
		google.charts.load('current', {'packages':['corechart']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = google.visualization.arrayToDataTable(dataTypes);

			_this.chartOptions = {
				enableInteractivity: nSettings.enableInteractivity,
				fontSize: nSettings.chartFontSize,
				backgroundColor: {
					fill: nSettings.backgroundColor,
					strokeWidth: nSettings.borderWidth,
					stroke:nSettings. borderColor
				},
				chartArea: {
					backgroundColor: {
						fill: nSettings.chartBackgroundColor,
						stroke: nSettings.chartBorderColor,
						strokeWidth: nSettings.chartBorderWidth
					},
					left: nSettings.chartLeftMargin,
					right: nSettings.chartRightMargin,
					top: nSettings.chartTopMargin,
					bottom: nSettings.chartBottomMargin,
				},
				theme: nSettings.maximizedView,
				legend: {
					position: nSettings.legendPosition,
					alignment: nSettings.legendAlignment,
					textStyle: {
						color: nSettings.legendColor,
						fontSize: nSettings.legendFontSize,
						italic: nSettings.legendItalicText,
						bold: nSettings.legendBoldText,
					}
				},
				tooltip: { 
					trigger: nSettings.tooltipTrigger,
					showColorCode: nSettings.showColorCode,
					textStyle: {
						color: nSettings.tooltipTextColor,
						fontSize: nSettings.tooltipFontSize,
						italic: nSettings.tooltipItalicText,
						bold: nSettings.tooltipBoldText,
					}
				},
				hAxis: {
					title: nSettings.hAxisTitle,
					textPosition: nSettings.hAxisTextPosition,
					direction: nSettings.hAxisDirection,
					textStyle: {
						color: nSettings.hAxisTextColor,
						fontSize: nSettings.hAxisTextFontSize,
						italic: nSettings.hAxisItalicText,
						bold: nSettings.hAxisBoldText,
					},
					slantedText: nSettings.hAxisSlantedText,
					slantedTextAngle: nSettings.hAxisSlantedTextAngle,
					format: nSettings.hAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.hAxisLabelFontSize,
						color: nSettings.hAxisLabelColor,
						italic: nSettings.hAxisItalicTitle,
						bold: nSettings.hAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.hAxisMinValue,
						max: nSettings.hAxisMaxValue,
					},
					gridlines: {
						count: nSettings.hAxisGridlinesCount,
						color: nSettings.hAxisGridlinesColor,
					},
				},
				vAxis: {
					title: nSettings.vAxisTitle,
					textPosition: nSettings.vAxisTextPosition,
					direction: nSettings.vAxisDirection,
					textStyle: {
						color: nSettings.vAxisTextColor,
						fontSize: nSettings.vAxisTextFontSize,
						italic: nSettings.vAxisItalicText,
						bold: nSettings.vAxisBoldText,
					},
					format: nSettings.vAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.vAxisLabelFontSize,
						color: nSettings.vAxisLabelColor,
						italic: nSettings.vAxisItalicTitle,
						bold: nSettings.vAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.vAxisMinValue,
						max: nSettings.vAxisMaxValue,
					},
					gridlines: {
						count: nSettings.vAxisGridlinesCount,
						color: nSettings.vAxisGridlinesColor,
					},
				},
				crosshair: {
					opacity: nSettings.crosshairOpacity,
					orientation: nSettings.crosshairOrientation,
					trigger: nSettings.crosshairTrigger,
				},
				interpolateNulls: nSettings.fillNulls,
				dataOpacity: nSettings.opacity,
				selectionMode: nSettings.multipleSelection,
				pointShape: nSettings.pointShape,
				pointSize: nSettings.pointSize,
			};

			if (nSettings.enableAnimation) {
				_this.chartOptions.animation = {
					startup: nSettings.animationStartup,
					duration: nSettings.animationDuration,
        			easing: nSettings.animationEasing,
				}
			}

			_this.chartObj = new google.visualization.ScatterChart(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by table chart
	AysChartPlugin.prototype.tableChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.chart_data_by_types[_this.chartType] != undefined ? _this.dbData.chart_data_by_types[_this.chartType] : _this.dbData.source;
		var dataTypes = _this.tableChartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);
		
		/* == Google part == */
		google.charts.load('current', {'packages':['table']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = google.visualization.arrayToDataTable(dataTypes);

			_this.chartOptions = {
				showRowNumber: nSettings.showRowNumber,
				sortColumn: nSettings.sortColumnIndex,
			};

			_this.chartObj = new google.visualization.Table(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by timeline chart
	AysChartPlugin.prototype.timelineChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.chart_data_by_types[_this.chartType] != undefined ? _this.dbData.chart_data_by_types[_this.chartType] : _this.dbData.source;
		var dataTypes = _this.timelineChartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);


		/* == Google part == */
		google.charts.load('current', {'packages':['timeline']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = google.visualization.arrayToDataTable(dataTypes);

			_this.chartOptions = {
				enableInteractivity: nSettings.enableInteractivity,
				timeline: {
					showRowLabels: nSettings.showRowLabels,
					singleColor: nSettings.singleColor,
				},
			};

			_this.chartObj = new google.visualization.Timeline(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by candlestick chart
	AysChartPlugin.prototype.candlestickChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.chart_data_by_types[_this.chartType] != undefined ? _this.dbData.chart_data_by_types[_this.chartType] : _this.dbData.source;
		var dataTypes = _this.candlestickChartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['corechart']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = google.visualization.arrayToDataTable(dataTypes, true);

			_this.chartOptions = {
				enableInteractivity: nSettings.enableInteractivity,
				fontSize: nSettings.chartFontSize,
				backgroundColor: {
					fill: nSettings.backgroundColor,
					strokeWidth: nSettings.borderWidth,
					stroke: nSettings.borderColor
				},
				chartArea: {
					backgroundColor: {
						fill: nSettings.chartBackgroundColor,
						stroke: nSettings.chartBorderColor,
						strokeWidth: nSettings.chartBorderWidth
					},
					left: nSettings.chartLeftMargin,
					right: nSettings.chartRightMargin,
					top: nSettings.chartTopMargin,
					bottom: nSettings.chartBottomMargin,
				},
				theme: nSettings.maximizedView,
				legend: {
					position: nSettings.legendPosition,
					alignment: nSettings.legendAlignment,
					textStyle: {
						color: nSettings.legendColor,
						fontSize: nSettings.legendFontSize,
						italic: nSettings.legendItalicText,
						bold: nSettings.legendBoldText,
					}
				},
				tooltip: { 
					trigger: nSettings.tooltipTrigger,
					showColorCode: nSettings.showColorCode,
					textStyle: {
						color: nSettings.tooltipTextColor,
						fontSize: nSettings.tooltipFontSize,
						italic: nSettings.tooltipItalicText,
						bold: nSettings.tooltipBoldText,
					}
				},
				hAxis: {
					title: nSettings.hAxisTitle,
					textPosition: nSettings.hAxisTextPosition,
					direction: nSettings.hAxisDirection,
					textStyle: {
						color: nSettings.hAxisTextColor,
						fontSize: nSettings.hAxisTextFontSize,
						italic: nSettings.hAxisItalicText,
						bold: nSettings.hAxisBoldText,
					},
					slantedText: nSettings.hAxisSlantedText,
					slantedTextAngle: nSettings.hAxisSlantedTextAngle,
					format: nSettings.hAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.hAxisLabelFontSize,
						color: nSettings.hAxisLabelColor,
						italic: nSettings.hAxisItalicTitle,
						bold: nSettings.hAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.hAxisMinValue,
						max: nSettings.hAxisMaxValue,
					},
					gridlines: {
						count: nSettings.hAxisGridlinesCount,
						color: nSettings.hAxisGridlinesColor,
					},
				},
				vAxis: {
					title: nSettings.vAxisTitle,
					textPosition: nSettings.vAxisTextPosition,
					direction: nSettings.vAxisDirection,
					textStyle: {
						color: nSettings.vAxisTextColor,
						fontSize: nSettings.vAxisTextFontSize,
						italic: nSettings.vAxisItalicText,
						bold: nSettings.vAxisBoldText,
					},
					format: nSettings.vAxisFormat,
					titleTextStyle: {
						fontSize: nSettings.vAxisLabelFontSize,
						color: nSettings.vAxisLabelColor,
						italic: nSettings.vAxisItalicTitle,
						bold: nSettings.vAxisBoldTitle,
					},
					viewWindow: {
						min: nSettings.vAxisMinValue,
						max: nSettings.vAxisMaxValue,
					},
					gridlines: {
						count: nSettings.vAxisGridlinesCount,
						color: nSettings.vAxisGridlinesColor,
					},
				},
				bar: {
					groupWidth: nSettings.groupWidth
				},
				focusTarget: nSettings.focusTarget,
				selectionMode: nSettings.multipleSelection,
			};

			if (nSettings.enableAnimation) {
				_this.chartOptions.animation = {
					startup: nSettings.animationStartup,
					duration: nSettings.animationDuration,
        			easing: nSettings.animationEasing,
				}
			}

			_this.chartObj = new google.visualization.CandlestickChart(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by sankey diagram
	AysChartPlugin.prototype.sankeyDiagramView = function(){
		var _this = this;
		var getChartSource = _this.dbData.chart_data_by_types[_this.chartType] != undefined ? _this.dbData.chart_data_by_types[_this.chartType] : _this.dbData.source;
		var dataTypes = _this.sankeyDiagramConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['sankey']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = google.visualization.arrayToDataTable(dataTypes);

			_this.chartOptions = {
				sankey: {
					link: {
						color: {
							fill: nSettings.linkColor,
							stroke: nSettings.linkBorderColor,
							strokeWidth: nSettings.linkBorderWidth,
						},
					},	
				},
			};

			_this.chartObj = new google.visualization.Sankey(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by treemap chart
	AysChartPlugin.prototype.treemapView = function(){
		var _this = this;
		var getChartSource = _this.dbData.chart_data_by_types[_this.chartType] != undefined ? _this.dbData.chart_data_by_types[_this.chartType] : _this.dbData.source;
		var dataTypes = _this.treemapConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['treemap']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = google.visualization.arrayToDataTable(dataTypes);

			_this.chartOptions = {
				showScale: nSettings.showScale,
				minColor: nSettings.minColor,
				maxColor: nSettings.maxColor,
			};

			_this.chartObj = new google.visualization.TreeMap(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	// Load chart by gantt chart
	AysChartPlugin.prototype.ganttChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.chart_data_by_types[_this.chartType] != undefined ? _this.dbData.chart_data_by_types[_this.chartType] : _this.dbData.source;
		var dataTypes = _this.ganttChartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['gantt']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = google.visualization.arrayToDataTable(dataTypes);

			_this.chartOptions = {
				gantt: {
					percentEnabled: nSettings.percentEnabled
				},
			};

			_this.chartObj = new google.visualization.Gantt(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}
	
	// Load chart by wordtree chart
	AysChartPlugin.prototype.wordTreeChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.chart_data_by_types[_this.chartType] != undefined ? _this.dbData.chart_data_by_types[_this.chartType] : _this.dbData.source;
		var dataTypes = _this.wordTreeChartConvertData(getChartSource);

		var treeFormat = (dataTypes[0].length == 1) ? 'implicit' : 'explicit';

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['wordtree']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = google.visualization.arrayToDataTable(dataTypes);

			_this.chartOptions = {
				wordtree: {
					format: treeFormat,
				},
				maxFontSize: nSettings.maxFontSize,
			};

			_this.chartObj = new google.visualization.WordTree(document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
			$(document).find("#" + _this.htmlClassPrefix + _this.chartType + _this.uniqueId + " svg g rect:last-child").eq(0).hide();
		}
		/* */
	}

	// Load chart by pie chart
	AysChartPlugin.prototype.pie3DChartView = function(){
		var _this = this;
		var getChartSource = _this.dbData.source;

		var dataTypes = _this.chartConvertData(getChartSource);

		var settings = _this.dbData.options;
		var nSettings =  _this.configOptionsForCharts(settings);

		/* == Google part == */
		google.charts.load('current', {'packages':['corechart']});
		google.charts.setOnLoadCallback(drawChart);

		function drawChart() {
			_this.chartData = google.visualization.arrayToDataTable( dataTypes );

			_this.chartOptions = {
				is3D: true,
				fontSize: nSettings.chartFontSize,
				chartArea: {
					left: nSettings.chartLeftMargin,
					right: nSettings.chartRightMargin,
					top: nSettings.chartTopMargin,
					bottom: nSettings.chartBottomMargin,
				},
				backgroundColor: {
					fill: nSettings.backgroundColor,
					strokeWidth: nSettings.borderWidth,
					stroke: nSettings.borderColor
				},
				enableInteractivity: nSettings.enableInteractivity,
				legend: {
					position: nSettings.legendPosition,
					alignment: nSettings.legendAlignment,
					textStyle: {
						color: nSettings.legendColor,
						fontSize: nSettings.legendFontSize,
						italic: nSettings.legendItalicText,
						bold: nSettings.legendBoldText,
					}
				},
				tooltip: { 
					trigger: nSettings.tooltipTrigger,
					showColorCode: nSettings.showColorCode,
					text: nSettings.tooltipText,
					textStyle: {
						color: nSettings.tooltipTextColor,
						fontSize: nSettings.tooltipFontSize,
						italic: nSettings.tooltipItalicText,
						bold: nSettings.tooltipBoldText,
					}
				},
				pieStartAngle: nSettings.rotationDegree,
				pieSliceBorderColor: nSettings.sliceBorderColor,
				reverseCategories: nSettings.reverseCategories,
				pieSliceText: nSettings.sliceText,
				sliceVisibilityThreshold: nSettings.dataGroupingLimit,
				pieResidueSliceLabel: nSettings.dataGroupingLabel,
				pieResidueSliceColor: nSettings.dataGroupingColor,
				slices: {}
			};

			for (var i = 0; i < dataTypes.length - 1; i++) {
				_this.chartOptions.slices[i] = {
					color: nSettings.sliceColor[i],
					offset: typeof nSettings.sliceOffset[i] !== 'undefined' ? nSettings.sliceOffset[i] : 0,
					textStyle: {
						color: nSettings.sliceTextColor[i],
					},
				}
			}

			_this.chartObj = new google.visualization.PieChart( document.getElementById(_this.htmlClassPrefix + _this.chartType + _this.uniqueId));

			_this.chartObj.draw( _this.chartData, _this.chartOptions );
			_this.resizeChart();
		}
		/* */
	}

	/* 
	  Configure all settings for all chart types
	  Getting settings for each chart type in respective function 
	*/
	AysChartPlugin.prototype.configOptionsForCharts = function (settings) {
		var newSettings = {};

		newSettings.chartFontSize = settings['font_size'];
		newSettings.backgroundColor = settings['transparent_background'] && settings['transparent_background'] === 'on' ? 'transparent' : settings['background_color'];
		newSettings.borderWidth = settings['border_width'];
		newSettings.borderColor = settings['border_color'];
		newSettings.tooltipTrigger = settings['tooltip_trigger'];
		newSettings.tooltipText = settings['tooltip_text'];
		newSettings.showColorCode = (settings['show_color_code'] == 'on') ? true : false;
		newSettings.tooltipItalicText = (settings['tooltip_italic'] == 'on') ? true : false;
		newSettings.tooltipBoldText = settings['tooltip_bold'];
		newSettings.legendItalicText = (settings['legend_italic'] == 'on') ? true : false;
		newSettings.legendBoldText = (settings['legend_bold'] == 'on') ? true : false;
		newSettings.tooltipTextColor = settings['tooltip_text_color'];
		newSettings.tooltipFontSize = settings['tooltip_font_size'];
		newSettings.legendPosition = settings['legend_position'];
		newSettings.legendAlignment = settings['legend_alignment'];
		newSettings.legendFontSize = settings['legend_font_size'];
		newSettings.rotationDegree = settings['rotation_degree'];
		newSettings.sliceBorderColor = settings['slice_border_color'];
		newSettings.reverseCategories = (settings['reverse_categories'] == 'on') ? true : false;
		newSettings.sliceText = settings['slice_text'];
		newSettings.legendColor = settings['legend_color'];
		newSettings.dataGroupingLimit = settings['data_grouping_limit']/100;
		newSettings.dataGroupingLabel = settings['data_grouping_label'];
		newSettings.dataGroupingColor = settings['data_grouping_color'];
		newSettings.sliceColor = settings['slice_color'];
		newSettings.sliceOffset = settings['slice_offset'];
		newSettings.sliceTextColor = settings['slice_text_color'];
		newSettings.chartBackgroundColor = settings['transparent_background'] && settings['transparent_background'] === 'on' ? 'transparent' : settings['chart_background_color'];
		newSettings.chartBorderWidth = settings['chart_border_width'];
		newSettings.chartBorderColor = settings['chart_border_color'];
		newSettings.chartLeftMargin = settings['chart_left_margin_for_js'];
		newSettings.chartRightMargin = settings['chart_right_margin_for_js'];
		newSettings.chartTopMargin = settings['chart_top_margin_for_js'];
		newSettings.chartBottomMargin = settings['chart_bottom_margin_for_js'];
		newSettings.isStacked = (settings['is_stacked'] == 'on') ? true : false;
		newSettings.focusTarget = settings['focus_target'];
		newSettings.groupWidthFormat = settings['group_width_format'] == '%' ? '%' : '';
		newSettings.groupWidth = settings['group_width'] + newSettings.groupWidthFormat;
		newSettings.hAxisTitle = settings['haxis_title'];
		newSettings.vAxisTitle = settings['vaxis_title'];
		newSettings.hAxisLabelFontSize = settings['haxis_label_font_size'];
		newSettings.vAxisLabelFontSize = settings['vaxis_label_font_size'];
		newSettings.hAxisLabelColor = settings['haxis_label_color'];
		newSettings.vAxisLabelColor = settings['vaxis_label_color'];
		newSettings.hAxisTextPosition = settings['haxis_text_position'];
		newSettings.vAxisTextPosition = settings['vaxis_text_position'];
		newSettings.vAxisDirection = (settings['vaxis_direction'] == '-1') ? -1 : 1;
		newSettings.hAxisDirection = (settings['haxis_direction'] == '-1') ? -1 : 1;
		newSettings.hAxisTextColor = settings['haxis_text_color'];
		newSettings.vAxisTextColor = settings['vaxis_text_color'];
		newSettings.hAxisBaselineColor = settings['haxis_baseline_color'];
		newSettings.vAxisBaselineColor = settings['vaxis_baseline_color'];
		newSettings.hAxisTextFontSize = settings['haxis_text_font_size'];
		newSettings.vAxisTextFontSize = settings['vaxis_text_font_size'];
		newSettings.hAxisSlantedText = settings['haxis_slanted'];
		newSettings.hAxisSlantedTextAngle = settings['haxis_slanted_text_angle'];
		newSettings.hAxisShowTextEvery = settings['haxis_show_text_every'];
		newSettings.vAxisFormat = settings['vaxis_format'];
		newSettings.hAxisFormat = settings['haxis_format'];
		newSettings.hAxisMinValue = settings['haxis_min_value'];
		newSettings.hAxisMaxValue = settings['haxis_max_value'];
		newSettings.vAxisMinValue = settings['vaxis_min_value'];
		newSettings.vAxisMaxValue = settings['vaxis_max_value'];
		newSettings.hAxisGridlinesCount = settings['haxis_gridlines_count'];
		newSettings.hAxisGridlinesColor = settings['haxis_gridlines_color'];
		newSettings.hAxisMinorGridlinesColor = settings['haxis_minor_gridlines_color'];
		newSettings.vAxisGridlinesCount = settings['vaxis_gridlines_count'];
		newSettings.vAxisGridlinesColor = settings['vaxis_gridlines_color'];
		newSettings.vAxisMinorGridlinesColor = settings['vaxis_minor_gridlines_color'];
		newSettings.hAxisItalicText = (settings['haxis_italic'] == 'on') ? true : false;
		newSettings.hAxisBoldText = (settings['haxis_bold'] == 'on') ? true : false;
		newSettings.vAxisItalicText = (settings['vaxis_italic'] == 'on') ? true : false;
		newSettings.vAxisBoldText = (settings['vaxis_bold'] == 'on') ? true : false;
		newSettings.hAxisItalicTitle = (settings['haxis_title_italic'] == 'on') ? true : false;
		newSettings.hAxisBoldTitle = (settings['haxis_title_bold'] == 'on') ? true : false;
		newSettings.vAxisItalicTitle = (settings['vaxis_title_italic'] == 'on') ? true : false;
		newSettings.vAxisBoldTitle = (settings['vaxis_title_bold'] == 'on') ? true : false;
		newSettings.opacity = settings['opacity'];
		newSettings.enableInteractivity = (settings['enable_interactivity'] == 'off') ? false : true;
		newSettings.maximizedView = (settings['maximized_view'] == 'on') ? 'maximized' : null;
		newSettings.enableAnimation = (settings['enable_animation'] == 'on') ? true : false;
		newSettings.animationDuration = settings['animation_duration'];
		newSettings.animationStartup = (settings['animation_startup'] == 'off') ? false : true;
		newSettings.animationEasing = settings['animation_easing'];
		newSettings.seriesColor = settings['series_color'];
		newSettings.seriesVisibleInLegend = settings['series_visible_in_legend'];
		newSettings.enableRowSettings = (settings['enable_row_settings'] == 'on') ? true : false;
		newSettings.rowsColor = settings['rows_color'];
		newSettings.rowsOpacity = settings['rows_opacity'];
		newSettings.multipleSelection = (settings['multiple_selection'] == 'on') ? 'multiple' : 'single';
		newSettings.multipleDataFormat = settings['multiple_data_format'];
		newSettings.pointShape = settings['point_shape'];
		newSettings.pointSize = settings['point_size'];
		newSettings.lineWidth = settings['line_width'];
		newSettings.crosshairTrigger = settings['crosshair_trigger'];
		newSettings.crosshairOrientation = settings['crosshair_orientation'];
		newSettings.crosshairOpacity = settings['crosshair_opacity'];
		newSettings.orientation = (settings['orientation'] == 'on') ? 'vertical' : 'horizontal';
		newSettings.fillNulls = (settings['fill_nulls'] == 'on') ? true : false;
		newSettings.holeSize = settings['donut_hole_size'];
		newSettings.keepAspectRatio = (settings['keep_aspect_ratio'] == 'on') ? true : false;
		newSettings.orgChartFontSize = settings['org_chart_font_size'];
		newSettings.allowCollapse = (settings['allow_collapse'] == 'on') ? true : false;
		newSettings.orgClassname = settings['org_classname'];
		newSettings.fill_nulls = (settings['fill_nulls'] == 'on') ? true : false;
		newSettings.minorTicks = settings['minor_ticks'];
		newSettings.comboType = settings['combo_type'];
		newSettings.showRowNumber = (settings['show_row_number'] == 'on') ? true : false;
		newSettings.sortColumnIndex = +settings['sort_column_index'];
		newSettings.showRowLabels = (settings['show_row_labels'] == 'on') ? true : false;
		newSettings.singleColor = (settings['timeline_single_color'] == 'on') ? settings['timeline_color'] : null;
		newSettings.linkColor = settings['sankey_link_color'];
		newSettings.linkBorderColor = settings['sankey_border_color'];
		newSettings.linkBorderWidth = settings['sankey_border_width'];
		newSettings.showScale = (settings['show_scale'] == 'on') ? true : false;
		newSettings.minColor = settings['min_color'];
		newSettings.maxColor = settings['max_color'];
		newSettings.percentEnabled = (settings['percent_enabled'] == 'on') ? true : false;
		newSettings.maxFontSize = settings['max_font_size'];

		return newSettings;
	}

	AysChartPlugin.prototype.setRowOptions = function (data, options, isJS = true) {
		var _this = this;
		
		if (data && data.length > 0) {
			if (data[0] && data[0].length == 2) {
				data[0].push({ role: 'style' });
				for (var i = 1; i < data.length; i++) {
					var opts = [];

					var color = isJS ? options.rowsColor[i - 1] : options.rows_color[i - 1];
					opts.push(color ? 'color:'+color : '');

					if (_this.chartType === 'bar_chart' || _this.chartType === 'line_chart' || _this.chartType === 'column_chart') {
						var opacity = isJS ? options.rowsOpacity[i - 1] : options.rows_opacity[i - 1];
						opts.push(opacity ? 'opacity:'+opacity : '');
					}

					data[i].push(opts.join(';'));
				}
			}
		}

		return data;
	}

	AysChartPlugin.prototype.removeRowOptions = function (data) {
		var _this = this;

		if (data && data.length > 0) {
			if (data[0] && data[0].length == 2) {
				for (var i = 0; i < data.length; i++) {
					data[i].splice(2, 1);
				}
			}
		}

		return data;
	}

	// Detect window resize moment to draw charts responsively
	AysChartPlugin.prototype.resizeChart = function(){
		var _this = this;

		//create trigger to resizeEnd event
		$(window).resize(function() {
			if(this.resizeTO) clearTimeout(this.resizeTO);
			this.resizeTO = setTimeout(function() {
				$(this).trigger('resizeEnd');
			}, 100);
		});

		//redraw graph when window resize is completed
		$(window).on('resizeEnd', function() {
			_this.drawChartFunction( _this.chartData, _this.chartOptions );
		});
	}

	// Function to handle live chart updates
	AysChartPlugin.prototype.handleLiveChartUpdate = function() {
		var _this = this;
		var settings = _this.dbData.options;

		var liveChartEnabled = (settings['enable_live_chart'] === 'on');
		if (liveChartEnabled) {
			var liveChartInterval = settings['live_chart_interval'];
			var data = {
                action: window.aysChartBuilderPublicChartSettings.ajax['actions']['get_chart_source_data'],
				security: window.aysChartBuilderPublicChartSettings.ajax['nonces']['get_chart_source_data'],
                chart_id: _this.chartId,
            };

			setTimeout( function startLiveChart() {
				$.ajax({
					url: chart_builder_public_ajax.ajax_url,
					dataType: 'json',
					method: 'post',
					data: data,
					success: function(newData) {
						_this.dbData.source = newData;

						var convertedData;

						if (_this.chartType == 'line_chart' || _this.chartType == 'bar_chart' || _this.chartType == 'column_chart' || _this.chartType == 'area_chart' || _this.chartType == 'combo_chart' || _this.chartType == 'stepped_area_chart') {
							convertedData = _this.multiColumnChartConvertData(newData);
						} else if (_this.chartType == 'org_chart') {
							convertedData = _this.orgChartConvertData(newData);
						} else if (_this.chartType == 'bubble_chart') {
							convertedData = _this.bubbleChartConvertData(newData);
						} else if (_this.chartType == 'scatter_chart') {
							convertedData = _this.scatterChartConvertData(newData);
						} else if (_this.chartType == 'table_chart') {
							convertedData = _this.tableChartConvertData(newData);
						} else if (_this.chartType == 'timeline_chart') {
							convertedData = _this.timelineChartConvertData(newData);
						} else if (_this.chartType == 'candlestick_chart') {
							convertedData = _this.candlestickChartConvertData(newData);
						} else if (_this.chartType == 'gantt_chart') {
							convertedData = _this.ganttChartConvertData(newData);
						} else if (_this.chartType == 'sankey_diagram') {
							convertedData = _this.sankeyDiagramConvertData(newData);
						} else if (_this.chartType == 'treemap') {
							convertedData = _this.treemapConvertData(newData);
						} else if (_this.chartType == 'word_tree') {
							convertedData = _this.wordTreeChartConvertData(newData);
						} else {
							convertedData = _this.chartConvertData(newData);
						}

						if (_this.chartType == 'candlestick_chart') {
							_this.chartData = google.visualization.arrayToDataTable(convertedData, true);
						} else {
							_this.chartData = google.visualization.arrayToDataTable(convertedData);
						}

						_this.drawChartFunction(_this.chartData, _this.chartOptions);
						setTimeout(startLiveChart, liveChartInterval);
					},
					error: function(xhr, status, error) {
						console.error('Error fetching data:', error);
					}
				});
			}, liveChartInterval);
		}
	};

	AysChartPlugin.prototype.setOrgChartCustomStyles = function () {
		var _this = this;
		var settings = _this.dbData.options;

		var orgClassname = settings['org_classname'];
		var bgColor = settings['org_node_background_color'];
		var padding = settings['org_node_padding'];
		var borderRadius = settings['org_node_border_radius'];
		var textColor = settings['org_node_text_color'];
		var textSize = settings['org_node_text_font_size'];
		var descriptionColor = settings['org_node_description_font_color'];
		var descriptionSize = settings['org_node_description_font_size'];

		if (orgClassname != '') {
			var node = _this.$el.find('.' + orgClassname);
			node.css({
				'background-color' : bgColor,
				'padding' : padding + 'px',
				'border-radius' : borderRadius + 'px',
				'color' : textColor,
				'font-size' : textSize + 'px',
				'border' : 'none'
			});
		}

		var description = _this.$el.find('.' + _this.htmlClassPrefix + 'org-chart-tree-description');
		description.css({
			'color' : descriptionColor,
			'font-size' : descriptionSize + 'px',
		});
		
		var image = _this.$el.find('.' + _this.htmlClassPrefix + 'org-chart-tree-image');
	}

	// Load chart by pie chart
	AysChartPlugin.prototype.chartConvertData = function( data ){
		var _this = this;
		var dataTypes = [];

		if (data[0] == undefined) {
			var titles = ['Title0', 'Title1'];
			if (_this.chartType == 'geo_chart') {
				titles.push('Url');
			}
			data[0] = titles;
		}

		// Collect data in new array for chart rendering
		for ( var key in data ) {
			if ( data.hasOwnProperty( key ) ) {
				if (key == 0) {
					if (data[key][0] != '' && data[key][1] != '') {
						if (data[0][2] != undefined) {
							dataTypes.push([
								_this.htmlDecode(data[key][0]), _this.htmlDecode(data[key][1]), data[key][2]
							]);
						} else {
							dataTypes.push([
								_this.htmlDecode(data[key][0]), _this.htmlDecode(data[key][1])
							]);
						}
					}
				} else {
					if (data[key][0] != '' && data[key][1] != '') {
						if (data[0][2] != undefined) {
							if (data[key][2] == undefined) {
								dataTypes.push([
									_this.htmlDecode(data[key][0]), +(data[key][1]), ''
								]);
							} else {
								dataTypes.push([
									_this.htmlDecode(data[key][0]), +(data[key][1]), data[key][2]
								]);
							}
						} else {
							dataTypes.push([
								_this.htmlDecode(data[key][0]), +(data[key][1])
							]);
						}
					}
				}
			}
		}

		return dataTypes;
	}

	// Converting chart data for multicolumn chart
	AysChartPlugin.prototype.multiColumnChartConvertData = function( data ){
		var _this = this;
		var dataTypes = [];
		var titleRow = [];

		if (data[0] == undefined) {
			var titles = [];
			for (var i = 0; i < data[1].length; i++) {
				titles.push("Title"+i);
			}
			data[0] = titles;
		}

		for (var key in data) {
			var dataRow = [];
			if (data.hasOwnProperty(key)) {
				if (key == 0) {
					for (var index in data[key]) {
						if (data[key][index] != '') {
							titleRow.push(_this.htmlDecode(data[key][index]));
						}
					}
					dataTypes.push(titleRow);
				} else {
					for (var index in data[key]) {
						if  (index == 0) {
							if (data[key][index] != '') {
							   dataRow.push(_this.htmlDecode(data[key][index]));
							}
						} else {
							dataRow.push(+data[key][index]);
						}
					}
					dataTypes.push(dataRow);
				}
			}
		}

		return dataTypes;
	}

	// Converting chart data for org chart type
	AysChartPlugin.prototype.orgChartConvertData = function( data ){
		var _this = this;
		var dataTypes = [['Name', 'Manager', 'Tooltip', 'Url']];
		// var name = "";
		// Collect data in new array for chart rendering
		for ( var key in data ) {
			if ( data.hasOwnProperty( key ) ) {
				if (key != 0) {
					var name = data[key][0];
					var description = data[key][1];
					var image = (data[key].length > 6) ? data[key][2] : '';
					var parent_name = (data[key].length > 6) ? data[key][3] : data[key][2];
					var tooltip = (data[key].length > 6) ? data[key][4] : data[key][3];
					var url = (data[key].length > 6) ? data[key][5] : '';
					
					if (description) {
						name += _this.orgChartFormatName(description);
					}
					if (image && image != '') {
						name = _this.orgChartFormatImage(image) + name;
					}
					name = {'v': data[key][0], 'f': name};
					dataTypes.push([
						name, parent_name, tooltip, url
					]);
				}
			}
		}

		return dataTypes;
	}

	AysChartPlugin.prototype.orgChartFormatName = function( description ){
		return `<div class="${this.htmlClassPrefix}org-chart-tree-description">${description}</div>`;
	}
	
	AysChartPlugin.prototype.orgChartFormatImage = function( image ){
		return `<div class="${this.htmlClassPrefix}org-chart-tree-image"><img width="128px" src="${image}"></div>`;
	}

	// Converting chart data for bubble chart type
	AysChartPlugin.prototype.bubbleChartConvertData = function( data ) {
		var _this = this;
		var dataTypes = [];
		var titleRow = [];

		for (var key in data) {
			var dataRow = [];
			if (data.hasOwnProperty(key)) {
				if (key == 0) {
					for (var index in data[key]) {
						if (data[key][index] != '') {
							titleRow.push(_this.htmlDecode(data[key][index]));
						}
					}
					dataTypes.push(titleRow);
				} else {
					for (var index in data[key]) {
						if  (index == 0 || index == 3) {
							if (data[key][index] != '') {
								dataRow.push(_this.htmlDecode(data[key][index]));
							}
						} else {
							dataRow.push(+data[key][index]);
						}
					}
					dataTypes.push(dataRow);
				}
			}
		}

		return dataTypes;
	}

	// Converting chart data for scatter chart type
	AysChartPlugin.prototype.scatterChartConvertData = function( data ) {
		var _this = this;
		var dataTypes = [];
		var titleRow = [];

		for (var key in data) {
			var dataRow = [];
			if (data.hasOwnProperty(key)) {
				if (key == 0) {
					for (var index in data[key]) {
						if (data[key][index] != '') {
							titleRow.push(_this.htmlDecode(data[key][index]));
						}
					}
					dataTypes.push(titleRow);
				} else {
					for (var index in data[key]) {
						if (data[key][index] != null) {
							dataRow.push(+data[key][index]);
						} else {
							dataRow.push(null);
						}
					}
					dataTypes.push(dataRow);
				}
			}
		}

		return dataTypes;
	}

	// Converting chart data for table chart type
	AysChartPlugin.prototype.tableChartConvertData = function( data ) {
		var _this = this;
		var dataTypes = [];
		var titleRow = [];

		for (var key in data) {
			var dataRow = [];
			if (data.hasOwnProperty(key)) {
				if (key == 0) {
					for (var index in data[key]) {
						if (data[key][index] != '') {
							titleRow.push(_this.htmlDecode(data[key][index]));
						}
					}
					dataTypes.push(titleRow);
				} else {
					for (var index in data[key]) {
						if (data[key][index].toString().toLowerCase() == 'true') {
							dataRow.push(true);
						} else if (data[key][index].toString().toLowerCase() == 'false') {
							dataRow.push(false);
						} else {
							dataRow.push(data[key][index]);
						}
					}
					dataTypes.push(dataRow);
				}
			}
		}

		return dataTypes;
	}

	// Converting chart data for timeline chart type
	AysChartPlugin.prototype.timelineChartConvertData = function( data ) {
		var _this = this;
		var dataTypes = [];
		var titleRow = [];

		for (var key in data) {
			var dataRow = [];
			if (data.hasOwnProperty(key)) {
				if (key == 0) {
					for (var index in data[key]) {
						titleRow.push(_this.htmlDecode(data[key][index]));
					}
					dataTypes.push(titleRow);
				} else {
					data[key].reverse();
					for (var index in data[key]) {
						if (index == 0 || index == 1) {
							dataRow.push(new Date(data[key][index]));
						} else {
							dataRow.push(_this.htmlDecode(data[key][index]));
						}
					}
					dataTypes.push(dataRow.reverse());
				}
			}
		}
		
		return dataTypes;
	}

	// Converting chart data for candlestick chart
	AysChartPlugin.prototype.candlestickChartConvertData = function( data ){
		var _this = this;
		var dataTypes = [];

		for (var key in data) {
			var dataRow = [];
			if (data.hasOwnProperty(key)) {
				for (var index in data[key]) {
					if  (index == 0) {
						dataRow.push(_this.htmlDecode(data[key][index]));
					} else {
						dataRow.push(+data[key][index]);
					}
				}
				dataTypes.push(dataRow);
			}
		}

		return dataTypes;
	}

	// Converting chart data for sankey chart type
	AysChartPlugin.prototype.sankeyDiagramConvertData = function( data ) {
		var _this = this;
		var dataTypes = [];
		var titleRow = [];

		for (var key in data) {
			var dataRow = [];
			if (data.hasOwnProperty(key)) {
				if (key == 0) {
					for (var index in data[key]) {
						titleRow.push(_this.htmlDecode(data[key][index]));
					}
					dataTypes.push(titleRow);
				} else {
					for (var index in data[key]) {
						if (index == 2) {
							dataRow.push(+data[key][index]);
						} else {
							dataRow.push(_this.htmlDecode(data[key][index]));
						}
					}
					dataTypes.push(dataRow);
				}
			}
		}
		
		return dataTypes;
	}

	// Converting chart data for treemap chart type
	AysChartPlugin.prototype.treemapConvertData = function( data ) {
		var _this = this;
		var dataTypes = [];
		var titleRow = [];

		for (var key in data) {
			var dataRow = [];
			if (data.hasOwnProperty(key)) {
				if (key == 0) {
					for (var index in data[key]) {
						titleRow.push(_this.htmlDecode(data[key][index]));
					}
					dataTypes.push(titleRow);
				} else {
					for (var index in data[key]) {
						if (data[key][index] == null) {
							dataRow.push(null);
						} else {
							if (index == 0 || index == 1) {
								dataRow.push(_this.htmlDecode(data[key][index]));
							} else {
								dataRow.push(+data[key][index]);
							}
						}
					}
					dataTypes.push(dataRow);
				}
			}
		}
		
		return dataTypes;
	}

	// Converting chart data for gantt chart type
	AysChartPlugin.prototype.ganttChartConvertData = function( data ) {
		var _this = this;
		var dataTypes = [];
		var titleRow = [];

		for (var key in data) {
			var dataRow = [];
			if (data.hasOwnProperty(key)) {
				if (key == 0) {
					for (var index in data[key]) {
						if (index == 3 || index == 4) {
							titleRow.push({label: _this.htmlDecode(data[key][index]), type: 'date'});
						} else if (index == 5 || index == 6) {
							titleRow.push({label: _this.htmlDecode(data[key][index]), type: 'number'});
						} else {
							titleRow.push(_this.htmlDecode(data[key][index]));
						}
					}
					dataTypes.push(titleRow);
				} else {
					for (var index in data[key]) {
						if (data[key][index] == 'null' || data[key][index] == null) {
							dataRow.push(null);
						} else {
							if (index == 3 || index == 4) {
								dataRow.push(new Date(data[key][index]));
							} else if (index == 5) {
								dataRow.push(+data[key][index] * 24 * 60 * 60 * 1000);
							} else if (index == 6) {
								dataRow.push(+data[key][index]);
							} else {
								dataRow.push(_this.htmlDecode(data[key][index]));
							}
						}
					}
					dataTypes.push(dataRow);
				}
			}
		}
		
		return dataTypes;
	}

	// Converting chart data for word tree chart
	AysChartPlugin.prototype.wordTreeChartConvertData = function( data ){
		var _this = this;
		var dataTypes = [];

		if (data[0].length == 1) {
			for (var key in data) {
				var dataRow = [];
				if (data.hasOwnProperty(key)) {
					for (var index in data[key]) {
						dataRow.push(_this.htmlDecode(data[key][index]));
					}
				}
				dataTypes.push(dataRow);
			}
		} else {
			for ( var key in data ) {
				if ( data.hasOwnProperty( key ) ) {
					if (key == 0) {
						dataTypes.push([
							{label: _this.htmlDecode(data[key][0]), type: 'number'}, _this.htmlDecode(data[key][1]), {label: _this.htmlDecode(data[key][2]), type: 'number'}, {label: _this.htmlDecode(data[key][3]), type: 'number'}, {label: _this.htmlDecode(data[key][4]), type: 'number'}
						]);
					} else {
						dataTypes.push([
							+data[key][0], _this.htmlDecode(data[key][1]), +data[key][2], +data[key][3], +data[key][4]
						]);
					}
				}
			}
		}

		return dataTypes;
	}

	AysChartPlugin.prototype.htmlDecode = function (input) {
		if (!input) return input;

		var e = document.createElement('div');
		e.innerHTML = input;
		return e.childNodes[0].nodeValue;
	}

	AysChartPlugin.prototype.drawChartFunction = function (source, options) {
		var _this = this;

		var view = new google.visualization.DataView(source);
		_this.chartData = source;

		if (_this.chartType == 'geo_chart') {
			view.setColumns([0, 1]);
		} else if (_this.chartType == 'org_chart') {
			view.setColumns([0, 1, 2]);
		}

		_this.chartObj.draw(view, options);
		
		if (_this.chartType == 'word_tree') {
			_this.$el.find("#" + _this.htmlClassPrefix + _this.chartType + " svg g rect:last-child").eq(0).hide();
		}

		if (_this.chartType == 'org_chart') {
			_this.setOrgChartCustomStyles();
		}
	}

	AysChartPlugin.prototype.exportOpenChartPrintWindow = function (buttonsContainer, type) {
		var _this = this;
		buttonsContainer.find(".ays-chart-export-button-" + _this.uniqueId + "[data-clicked='true']").removeAttr('data-clicked');
		if(typeof  _this.chartOptions !== undefined){
			_this.chartOptions.width = '800';
		}

		var iframe =  buttonsContainer.find("iframe");
		iframe.attr('id','iframe-' + _this.uniqueId);
		_this.resizeChart();
		
		if (_this.chartType == 'word_tree' ){ // without this condition it resets chart view
			iframe.contents().find('body').append($(document).find('#' + _this.htmlClassPrefix + _this.chartType + _this.uniqueId).clone());

			if(type == 'image' && typeof _this.chartObj.getImageURI != "undefined"){
				var imageURI = _this.chartObj.getImageURI();
				var downloadTag = $('<a>');
				downloadTag.attr('href',imageURI);
				downloadTag.text('download link');
				downloadTag.attr('download',_this.chartType);
				
				downloadTag[0].click();
			}
			if(type != 'image'){
				window.frames['iframe-' + _this.uniqueId].contentWindow.print();
			}
			iframe.removeAttr('id');
			iframe.contents().find('head').html("");
			iframe.contents().find('body').html("");
			return ;
		}

		var listener = google.visualization.events.addListener(_this.chartObj, 'ready',function () {
			google.visualization.events.removeListener(listener)
			var clonedContent = $(document).find('#' + _this.htmlClassPrefix + _this.chartType + _this.uniqueId).clone();
			_this.chartOptions.height = '';
			_this.chartOptions.width = '';
			// _this.drawChartFunction( _this.chartData, _this.chartOptions , _this.chartType);
			_this.loadChartBySource();

			setTimeout(function(){ //setting timeout for complete init

				
				// check if can create image for download
				if(type == 'image' && typeof _this.chartObj.getImageURI != "undefined"){
					var imageURI = _this.chartObj.getImageURI();
					var downloadTag = $('<a>');
					downloadTag.attr('href',imageURI);
					downloadTag.text('download link');
					downloadTag.attr('download',_this.chartType);
					
					downloadTag[0].click();
				}
				
					iframe.contents().find('body').append(clonedContent);
				if (_this.chartType == 'org_chart' || _this.chartType == 'table_chart'){
					var linkHref = "";
					var linkScript = $('<link>');
					switch (_this.chartType){
						case 'org_chart':
							linkHref = "https://www.gstatic.com/charts/48.1/css/orgchart/orgchart.css"; //48.1 is google chart version , check current version
							break;
							case 'table_chart':
							linkHref = "https://www.gstatic.com/charts/48.1/css/table/table.css"; //48.1 is google chart version , check current version
							break;
						default:
							break;
					}
					linkScript.attr('rel','stylesheet');
					linkScript.attr('href',linkHref);
	
					var oHead = iframe.contents().find('body');
					linkScript.ready(function(){
						oHead.append(linkScript);
					});
				}
				
				if(type != 'image'){
						window.frames['iframe-' + _this.uniqueId].contentWindow.print();

				}

				iframe.contents().find('head').html("");
				iframe.contents().find('body').html("");
				iframe.removeAttr('id');
			},200);
			
		});
		_this.drawChartFunction( _this.chartData, _this.chartOptions);
	}

	AysChartPlugin.prototype.exportData = function () {
		var _this = this;
		var title = _this.chartType;
		title = title == "" ? 'ays_chart_export' : title;
		var data =  Object.assign([],_this.dbData.source);
		var exportFileType = $(document).find(".ays-chart-export-button-" + _this.uniqueId + "[data-clicked='true']").attr('data-type');
		if (!data || data.length === 0 ){
			return ;
		}
		$(document).find(".ays-chart-export-button-" + _this.uniqueId + "[data-clicked='true']").removeAttr('data-clicked');

		if(title == 'org_chart' && data[0] == undefined ){ //_this.chartType
			data[0] = ['Name', 'Description', 'Image', 'Parent name', 'Tooltip', 'Url', 'Parent ID', 'Level'];
			data = Object.values(data);
		}
		switch (exportFileType){
			case 'xlsx':
				var dataXlsx = [];
				var dataXlsxRow = [];

				for (let i = 0; i < data.length; i++) {
					dataXlsxRow = [];

					for (let j = 0; j < data[i].length; j++) {
						dataXlsxRow[j] = { 'text' :  data[i][j]};
					}
					dataXlsx[i] = dataXlsxRow;
				}
				
				var options = {	
								fileName: title,
								header: false
							};
				var tableData = [{
								"sheetName": "Chart",
								"data": dataXlsx
							}];
				Jhxlsx.export(tableData, options);
				break;
			case 'csv':
				var csvOptions = {
					separator: ',',
					fileName: title
				};
				
				data.forEach(row => {
					row.forEach((col, index) => {
						if (typeof(col) == 'string' && (col.includes(",") || col.includes("\n"))) {
							col = col.replace(/[\n,]/g, '');
							row[index] = `${col}`;
						}
					});
				});
				var headers = "";
				if(data[0]){
					headers  = data[0]
				}
				data.shift();
				var exportCSV = new CSVExport(data, headers, csvOptions);
				break;
			case 'copy':
				var copyText = data.join('\n');
				navigator.clipboard.writeText(copyText).then(function(x) {
					alert("Data copied to clipboard.");
				  });
				break;
			default:
				break;
		}
	}	

	$.fn.AysChartBuilder = function(options) {
		return this.each(function() {
			if (!$.data(this, 'AysChartBuilder')) {
				$.data(this, 'AysChartBuilder', new AysChartPlugin(this, options));
			} else {
				try {
					$(this).data('AysChartBuilder').init();
				} catch (err) {
					console.error('AysChartBuilder has not initiated properly');
				}
			}
		});
	};

})(jQuery);
