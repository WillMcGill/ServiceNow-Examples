/*
The options available to you are:
options - the charts options that are sent in
filter - the filter string that we are receiving

Notes: 
- Avoid use of variables with a name of "data", "options", or "filter" as they will cause conflicts with data collection for this chart.
- chartData must be returned in the format set in this default script
- When using with Report Generator, the conditions are built into the options.conditions property so you can reference that in your query
- When using with Summaries, you can use either the summaryConditions property or the summaryPrimary property to build your query
*/

// A placeholder returnData holding a no data result
var returnData = ["VC no data"];

try {

    // Write your collection code here to populate the returnData array
    returnData = [];
    var rows = [];
    var headers = ['Phase',
        'Project #',
        'Project Name',
        'Company Specific Category',
        'Description',
        'Key Initiative',
        'Value',
        'Size',
        'Project Sponsor',
        'Project Owner',
        'Project Manager',
        'Comments',
        'Overall Health',
        'Cost',
        'Scope',
        'Schedule',
        'Resources',
        'Status Date'
    ];

    var projectGR = new GlideRecord('pm_project');
    projectGR.addEncodedQuery('active=true^ORclosed_atRELATIVEGT@dayofweek@ago@14');
	if(options.summaryPrimary != null && options.summaryPrimary != '' && options.summaryPrimary != undefined && options.summaryPrimary != false){
		projectGR.addEncodedQuery('primary_portfolio=' + options.summaryPrimary);
	}
    projectGR.query();

    while (projectGR.next()) {
        var row = [];
        var sysID = projectGR.getValue('sys_id');
        var phase = projectGR.getDisplayValue('phase');
        var number = projectGR.getValue('number');
        var projectName = projectGR.getValue('short_description');
        var description = projectGR.getValue('description');
        var category = projectGR.getDisplayValue('u_company_specific_categories');
        var initiative = projectGR.getDisplayValue('u_key_initiative_task');
        var value = projectGR.getValue('score_value');
        var size = projectGR.getValue('score_size');
        var sponsor = projectGR.getDisplayValue('u_project_sponsor');
        var owner = projectGR.getDisplayValue('u_project_owner');
        var manager = projectGR.getDisplayValue('project_manager');
        var comments = projectGR.getValue('comments');

        //Get Project Status Information
        var statusGR = new GlideRecord('project_status');
        statusGR.addQuery('project', sysID);
        statusGR.orderByDesc('as_on');
        statusGR.setLimit(1);
        statusGR.query();

        while (statusGR.next()) {
            var overall = statusGR.getValue('overall_health');
            var cost = statusGR.getValue('cost');
            var scope = statusGR.getValue('scope');
            var schedule = statusGR.getValue('schedule');
            var resources = statusGR.getValue('resources');
            var date = statusGR.getDisplayValue('as_on');
        }

        var phaseColor = '#FFFFFF';
        if (phase == 'Initiating') {
            phaseColor = '#BB1227';
        } else if (phase == 'Planning') {
            phaseColor = '#88868A';
        } else if (phase == 'Executing') {
            phaseColor = '#347DBE';
        } else if (phase == 'Delivering') {
            phaseColor == '#FFC633';
        } else if (phase == 'Closing') {
            phaseColor == '#8FA1B9';
        }

        row.push({
            value: '<span style="color:white;">' + phase + '</span>',
            backgroundColor: phaseColor
        }, {
            value: number,
            backgroundColor: 'white'
        }, {
            value: projectName,
            backgroundColor: 'white'
        }, {
            value: category == null ? '' : category,
            backgroundColor: 'white'
        }, {
            value: description == null ? '' : description,
            backgroundColor: 'white'
        }, {
            value: initiative == 'false' ? 'N': 'Y',
            backgroundColor: 'white'
        }, {
            value: value,
            backgroundColor: 'white'
        }, {
            value: size,
            backgroundColor: 'white'
        }, {
            value: sponsor == null ? '' : sponsor,
            backgroundColor: 'white'
        }, {
            value: owner == null ? '' : owner,
            backgroundColor: 'white'
        }, {
            value: manager == null ? '' : manager,
            backgroundColor: 'white'
        }, {
            value: comments,
            backgroundColor: 'white'
        }, {
            value: convertStatus(overall),
            backgroundColor: convertBackground(overall)
        }, {
            value: convertStatus(cost),
            backgroundColor: convertBackground(cost)
        }, {
            value: convertStatus(scope),
            backgroundColor: convertBackground(scope)
        }, {
            value: convertStatus(schedule),
            backgroundColor: convertBackground(schedule)
        }, {
            value: convertStatus(resources),
            backgroundColor: convertBackground(resources)
        }, {
            value: date != undefined ? '<span>' + date + '</span>' : '',
            backgroundColor: 'white'
        });
        rows.push(row);
    }



    returnData.push({
        "rows": rows,
        "headers": headers
    });



} catch (err) {
    gs.info("VC Portfolio Review error: " + JSON.stringify(err));
    // Handle any errors here
    // Set returnData to empty array to display error
    returnData = ["VC no data"];
}

// This is where the returnData is prepped for the front-end code
chartData = {
    data: {
        chartData: returnData
    },
    options: options
};

function convertStatus(statusString) {
    if (statusString == 'red') {
        return '<span style="font-size:20px;color:#F2314B; margin:auto;">6</span>';
    } else if (statusString == 'yellow') {
        return '<span style="font-size:20px;color:#B89319;margin:auto;">4</span>';
    } else if (statusString == 'green') {
        return '<span style="font-size:20px; color:#249E6C;margin:auto;">5</span>';
    } else {
        return '';
    }
}

function convertBackground(statusString) {
    if (statusString == 'red') {
        return '#E696A1';
    } else if (statusString == 'yellow') {
        return '#F1E6C3';
    } else if (statusString == 'green') {
        return '#E6F0DF';
    } else {
        return '';
    }
}