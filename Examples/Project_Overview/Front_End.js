const { height, zoom } = chartSize;
const titleDisplay = options.title.display;
const titleFontSize = options.title.size;
const cellStyles = `font-size: calc(16px * ${zoom / 100});`;
const titleSpace = titleDisplay ? Number(titleFontSize.slice(0, titleFontSize.length - 2)) * (zoom / 100) : 0;
const maxHeight = height - (80 * (zoom / 100)) - titleSpace + 'px';

const rows = data.chartData[0].rows.map((row) => {

    return (
        `<tr>
				${row.map((cell) => {
            return `<td style="background-color: ${cell.backgroundColor}; ${cellStyles} border: 1px solid; text-align:center;">${cell.value}</td>`;
        }).join('')}
			</tr>`
    );
}).join('')

const headers = data.chartData[0].headers.map((header) => {

    return (
        `<td width='100px' style="${cellStyles}; background-color:#3460A3; color:white; border: 1px solid; text-align:center;">${header}</td>`
    );
}).join('')

html = `
<div  class="list-chart list-scroll pagination" style="--zoom: ${zoom / 100}; overflow: auto; max-height: ${maxHeight};"><table>
		<thead>
		    ${headers}				
		</thead>
				<tbody>
					${rows}
				</tbody>
			</table>
		</div>
`

return html