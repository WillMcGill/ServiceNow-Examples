ChartGeneration.BurnDown = function (options, filter) {
	
	var returnData;
	var secondDateField = options.secondDateField;
	var secondTable = options.secondTable;
	var secondConditions = options.secondConditions;
	var secondAggField = options.secondAggField;
	var secondAggType = options.secondAggType;
	var filter = filter;
	var secondFilter = filter;
	var customOption = NaN;
	
	//this custom option can be set in the VCDCS it will replace the starting total
	if(options.customOption){
		customOption = options.customOption;
	}

		filter = ChartGenerationHelpers.parseFilter(filter, options.conditions);
		secondFilter = ChartGenerationHelpers.parseFilter(secondFilter, secondConditions);

	// set up the data
	var data = {
		firstData: false,
		secondData: false,
		formatData: false
	};

	var formatData = {
		chartData: []
	}

	// get the resource plans by date
	var firstData = ChartGeneration.SingleTime(options, filter);
	firstData.chartData = ChartGenerationHelpers.sortTrendStringArray(firstData.chartData, 'name', options.trendType, options.fiscalPeriod, true);
	data.firstData = firstData;
	
	//If no allocated hours, do nothing
	if (firstData.chartData[0] !== 'VC no data') {
		// handle second number	
		var secondOptions = JSON.parse(JSON.stringify(options));
		secondOptions.dateField = secondDateField;
		secondOptions.table = secondTable;
		secondOptions.conditions = secondConditions;
		secondOptions.aggField = secondAggField;
		secondOptions.aggType = secondAggType;

		//get the time card entries by date
		var secondData = ChartGeneration.SingleTime(secondOptions, filter);
		secondData.chartData = ChartGenerationHelpers.sortTrendStringArray(secondData.chartData, 'name', options.trendType, options.fiscalPeriod, true);
		data.secondData = secondData;
		if(secondData.chartData[0] === 'VC no data'){
			var returnData = {
				chartData: ['VC no data']
			};

			return returnData;
		}

		//Get starting total sum of resource allocations
		var startTotal = 0;
		var totalAllocations = new GlideAggregate(options.table);
		totalAllocations.addEncodedQuery(filter);
		totalAllocations.setGroup(false);
		totalAllocations.addAggregate('SUM', options.aggField);
		totalAllocations.query();

		if (totalAllocations.next()) {
			startTotal = Number(totalAllocations.getAggregate('SUM', options.aggField));

			//Checking for NaN as it is possible for a user to set the custom option types other than numbers
			if(!isNaN(Number(customOption))) {
				startTotal = customOption;
			}
		} else {
			//If there is no data, this is handled on line 1102, fall back to 0 just in case
			startTotal = 0;
		}

		
		//Grab the total time card hours
		var timeCardTotal = 0;
		var totalTimeCardAllocations = new GlideAggregate(options.secondTable);
		totalTimeCardAllocations.addEncodedQuery(secondFilter);
		totalTimeCardAllocations.setGroup(false);
		totalTimeCardAllocations.addAggregate('SUM', options.secondAggField);
		totalTimeCardAllocations.query();

		if (totalTimeCardAllocations.next()) {
			timeCardTotal = totalTimeCardAllocations.getAggregate('SUM', options.secondAggField);
		} else {
			//No time cards is ok, set to 0
			timeCardTotal = 0;
		}

		var match = false;
		var startWeek;
		var endWeek;
		var startGDT;
		var weekArr = [];

		// Grab the first date from the resource plan
		if (firstData.chartData[0]) {
			startGDT = new GlideDateTime(firstData.chartData[0].name);
			startWeek = startGDT.getWeekOfYearLocalTime() + '-' + startGDT.getYearUTC();
		}

		//Grab the end dates from the 2 data sets and test for which is greater
		var projected = false;
		if (firstData.chartData[firstData.chartData.length - 1] && secondData.chartData[secondData.chartData.length - 1]) {
			if (firstData.chartData[firstData.chartData.length - 1].name) {
				var firstGDT = new GlideDateTime(firstData.chartData[firstData.chartData.length - 1].name);
			}
			if (secondData.chartData[secondData.chartData.length - 1].name) {
				var secondGDT = new GlideDateTime(secondData.chartData[secondData.chartData.length - 1].name);

				if (secondGDT.compareTo(firstGDT) == 1) {
					endWeek = secondGDT.getWeekOfYearLocalTime() + '-' + secondGDT.getYearUTC();
				} else {
					endWeek = firstGDT.getWeekOfYearLocalTime() + '-' + firstGDT.getYearUTC();
				}
			} else {
				endWeek = firstGDT.getWeekOfYearLocalTime() + '-' + firstGDT.getYearUTC();
			}
		}

		//Create the week array
		if (startWeek && endWeek) {

			var currentWeek = startWeek;
			var firstWeek = true;
			var weekBegin;

			while (currentWeek != endWeek) {
				if (!firstWeek) {
					startGDT.addWeeksLocalTime(1);
				}
				//Format the date to dd/MM/yyyy
				try {
					var weekBeginArr = startGDT.getDisplayValue().slice(0, 10).split('-');
					if (weekBeginArr.length == 3) {
						weekBegin = weekBeginArr[1] + '/' + weekBeginArr[2] + '/' + weekBeginArr[0];
					}

					//If the week is greater than that last time card entry, flag as projected hours
					if (startGDT.compareTo(secondGDT) == 1) {

						projected = true;
					}

					//increment the week
					var splitWeek = currentWeek.split('-');
					if (splitWeek[0] == 52) {
						splitWeek[0] = 1;
						splitWeek[1]++
					} else {
						splitWeek[0]++;
					}

					currentWeek = splitWeek.join('-');
					weekArr.push({
						"current": currentWeek,
						"beginDate": weekBegin,
						"projected": projected
					})
					firstWeek = false;
				} catch (e) {
					// Do not create array
				}
			}
		}

		//Loop through week array to create formatted data
		if (weekArr.length > 0) {
			for (var i = 0; i < weekArr.length; i++) {
				match = false;
				for (var k = 0; k < secondData.chartData.length; k++) {

					//Check for matching keys between the 2 data sets, subtract from total if time card present
					var secondKeyGDT = new GlideDateTime(secondData.chartData[k].name);
					var secondWeek = secondKeyGDT.getWeekOfYearLocalTime();
					var secondYear = secondKeyGDT.getYearUTC();
					var secondKey = secondWeek + '-' + secondYear;

					if (secondKey == weekArr[i].current) {
						match = true;
						if (secondData.chartData[k]) {
							secondData.chartData[k].name = weekArr[i].beginDate;
							secondData.chartData[k].hours = secondData.chartData[k].value;
							startTotal -= secondData.chartData[k].hours;
							secondData.chartData[k].value = String(Number(startTotal).toFixed(2));
							secondData.chartData[k].type = "time_card";
							secondData.chartData[k].projected = weekArr[i].projected
							secondData.chartData[k].query = {
								"type": "default",
								"query": secondData.chartData[k].query.query
							},

								formatData.chartData.push(secondData.chartData[k]);
						}
						break;
					}
				}
				//If no time card present maintain total hours bucket if projected flag is false, else decrement from the total

				if (!match) {
					var key;
					for (var j = 0; j < firstData.chartData.length; j++) {
						var keyGDT = new GlideDateTime(firstData.chartData[j].name);
						var week = keyGDT.getWeekOfYearLocalTime();
						var year = keyGDT.getYearUTC();
						key = week + '-' + year;

						if (key == weekArr[i].current) {
							match = true;
							if (firstData.chartData[j]) {
								firstData.chartData[j].name = weekArr[i].beginDate;
								firstData.chartData[j].hours = firstData.chartData[j].value;
								firstData.chartData[j].type = "resource_plan";
								if (weekArr[i].projected == true) {
									startTotal -= firstData.chartData[j].hours;
								}
								firstData.chartData[j].value = String(Number(startTotal).toFixed(2));
								firstData.chartData[j].projected = weekArr[i].projected

								formatData.chartData.push(firstData.chartData[j]);
							}
						}
					}
				}

				//if there is no week match from the resource or time card table, push to format data with no decremented hours
				if (!match) {
					var length = formatData.chartData.length;

					if (formatData.chartData[length - 1]) {
						var tempObj = {
							'name': weekArr[i].beginDate,
							'value': String(Number(startTotal).toFixed(2)),
							'hours': 0,
							'type': "resource_plan",
							'projected': weekArr[i].projected,
							'query': {
								"type": "default",
								"query": formatData.chartData[length - 1].query.query,
							}
						}
						formatData.chartData.push(tempObj);
					
					}
				}
			}
			//Sort the data
			formatData.chartData = ChartGenerationHelpers.sortTrendStringArray(formatData.chartData, 'name', options.trendType, options.fiscalPeriod, true);
			data.formatData = formatData;

			//Push to data array, only format data is used in current iteration, but keeping first and second for future versions
			var dataArray = [];
			dataArray.push(data.firstData);
			dataArray.push(data.secondData);
			dataArray.push(data.formatData);

			returnData = data.formatData;
			
		} else {
			//If the week array length is 0, or is malformed push no data to avoid chart crashing
			returnData = {
				chartData: ['VC no data']
			};
		}
	} else {
		returnData = {
			chartData: ['VC no data']
		};
	}

	// return the data
	return returnData;
};