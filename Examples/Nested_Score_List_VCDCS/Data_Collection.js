try {
    var table = options.table;
    var conditions = options.conditions;
    var groupBys = options.multiOptions;
    var columns = options.columns;
    var aggType = options.aggType;
    var aggField = options.aggField;
    var limit = parseInt(options.limit);
    var duration = false;

    // Hardcoded GroupBys, to circumvent the current dot walking limitation 
    groupBys[0] = { "value": "task.ref_pm_project.primary_portfolio" };
    groupBys[1] = { "value": "task.ref_pm_project" };
    groupBys[2] = { "value": "user" };

    // determine which type of chart we are returning to the front end
    var type = '';
    if (columns != false && columns != undefined) {
        type = 'nestedList';
    } else if (aggType != false && aggType != undefined) {
        type = 'nestedScoreList';
    }
    if (aggType !== 'COUNT' && type === 'nestedScoreList') {
        duration = VividFunction.determineDuration(table, aggField);
    }

    // if we are building a nested list just push the columns into group bys and the 
    // collection script will add those values correctly to their respective depths
    var columnsIndex = groupBys.length;
    if (type === 'nestedList') {
        // add sys_id group by so we can ensure we're getting individual records for
        // the nested list and for a more accurate and clean query for clickthroughs
        groupBys.push({ value: 'sys_id' });
        for (var i = 0; i < columns.length; i++) {
            groupBys.push(columns[i]);
        }
    }

    // parse out negative limits
    if (limit < 1) {
        limit = 0;
    }

    // handle filter
    if (typeof filter == "string" && filter !== false && filter !== '') {
        conditions = conditions.split('^NQ');

        for (i = 0; i < conditions.length; i++) {
            if (conditions[i] === '^EQ') {
                conditions[i] = filter;
            } else {
                conditions[i] = filter + "^" + conditions[i];
            }
        }

        conditions = conditions.join('^NQ');
    }

    // construct the query
    var nestedListGR = new GlideAggregate(table);
    nestedListGR.addEncodedQuery(conditions);

    // loop through groupBys and add them to the query
    for (var i = 0; i < groupBys.length; i++) {
        nestedListGR.groupBy(groupBys[i].value);
    }

    // handle aggType
    if (aggType === 'COUNT') {
        nestedListGR.addAggregate(aggType);
    } else if (type === 'nestedScoreList') {
        nestedListGR.addAggregate(aggType, aggField);
    }

    nestedListGR.setLimit(limit);

    // execute query
    nestedListGR.query();

    // loop through groups and push them to nested arrays
    var headers = [];
    var data = [];
    var limitCounter = 0;
    while (nestedListGR.next() && limitCounter < limit) {
        // query we will build on to as we move deeper into the nest
        var query = table + '_list.do?sysparm_query=' + (conditions !== '^EQ' ? conditions : '');

        // loop through groupBys and get the values starting at the top level
        var currentDepth = data;
        for (var i = 0; i < groupBys.length; i++) {
            // continue if we hit the sys_id groupBy that's only added for queries
            if (i === columnsIndex) {
                continue;
            }

            var group = groupBys[i].value;
            var displayValue = nestedListGR.getDisplayValue(group);
            var queryType = 'custom';

            // object containing the data we will push if we push it
            var tempObj = {
                group: group,
                value: displayValue,
                query: {
                    type: queryType,
                    query: query += String(nestedListGR.getEncodedQuery())
                },
                children: []
            };

            // if there is no data at the current depth, push what we have and move on
            if (currentDepth.length === 0) {
                currentDepth.push(tempObj);
                currentDepth = currentDepth[0].children;
                continue;
            }

            // if there is data at the current depth see if our current group is already in there
            for (var j = 0; j < currentDepth.length; j++) {
                // if we found a matching group, move on to that depth
                if (currentDepth[j].group === group && currentDepth[j].value === displayValue) {
                    currentDepth = currentDepth[j].children;
                    break;
                    // if our group is not already here, push it
                } else if (j === currentDepth.length - 1) {
                    currentDepth.push(tempObj);
                    // make our recently pushed group the currentDepth
                    currentDepth = currentDepth[j + 1].children;
                }
            }
        }

        // push the aggregate for this group if this is a nestedScoreList 
        if (type === 'nestedScoreList') {
            var aggregate = 0;
            if (aggType === 'COUNT') {
                aggregate = nestedListGR.getAggregate(aggType);
            } else if (duration) {
                aggregate = VividFunction.convertDuration(nestedListGR.getAggregate(aggType, aggField));
                // format duration to human readable string
                var timeFormatted = "";
                if (aggregate) {
                    var days = Math.floor(aggregate / (24 * 60 * 60 * 1000));
                    var daysms = aggregate % (24 * 60 * 60 * 1000);
                    var hours = Math.floor(daysms / (60 * 60 * 1000));
                    var hoursms = aggregate % (60 * 60 * 1000);
                    var minutes = Math.floor(hoursms / (60 * 1000));
                    if (days > 0) {
                        timeFormatted += days + (days === 1 ? " Day" : " Days");
                    }
                    if (hours > 0) {
                        timeFormatted += " " + hours + (hours === 1 ? " Hour" : " Hours");
                    }
                    if (minutes > 0) {
                        timeFormatted += " " + minutes + (minutes === 1 ? " Minute" : " Minutes");
                    }
                }
                aggregate = timeFormatted;
            } else {
                aggregate = nestedListGR.getAggregate(aggType, aggField);
            }

            // parse for extra symbols
            if (!duration) {
                aggregate = VividFunction.parseNumericalString(aggregate);
            }

            // format the number
            if (!duration) {
                aggregate = Number(aggregate).toFixed(2);
            }

            var tempObj = {
                group: aggType,
                value: aggregate,
                query: {
                    type: 'custom',
                    query: query
                },
                children: []
            };

            currentDepth.push(tempObj);
        }
        limitCounter++;
    }

    // handle no data
    if (data.length === 0) {
        data = ['VC no data'];
    }

    // if we are returning a nestedScoreList push the agg type as the final header
    if (type === 'nestedScoreList') {
        var aggLabel = '';
        switch (aggType) {
            case 'COUNT':
                aggLabel = 'Count';
                break;
            case 'COUNT(DISTINCT':
                aggLabel = 'Distinct Count';
                break;
            case 'AVG':
                aggLabel = 'Average';
                break;
            case 'MAX':
                aggLabel = 'Maximum';
                break;
            case 'MIN':
                aggLabel = 'Minimum';
                break;
            case 'SUM':
                aggLabel = 'Sum';
                break;
            default:
                aggLabel = '';
                break;
        }
        headers.push(aggLabel);
    }
    //Hardcoded, otherwise will return as Empty
    headers = ["Portfolio", "Project", "Resource", "FTE"]
    var returnData = {
        headers: headers,
        chartData: data
    };

    var chartData = {
        data: returnData,
        options: options
    }
} catch (e) {
    VividErrorHelpers.generateMessage('VividInternalError', 'error', 'Base Nested Score List Custom Chart VCDCS Script: ' + JSON.stringify(e))
}
