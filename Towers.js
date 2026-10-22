// Each cell has a map position and a latitude/longitude.
const CELL_DATA = [
    {id: 'A', easting:536660, northing:183800, longitude: -0.03098, latitude: 51.53657},
    {id: 'B', easting:537032, northing:184006, longitude:-0.02554, latitude:51.53833},
    {id: 'C', easting:537109, northing:183884, longitude:-0.02448, latitude:51.53721},
    {id: 'D', easting:537110, northing:184695, longitude:-0.02415, latitude:51.54450},
    {id: 'E', easting:537206, northing:184685, longitude:-0.02277, latitude:51.54439},
    {id: 'F', easting:537248, northing:185016, longitude:-0.02204, latitude:51.54735},
    {id: 'G', easting:537250, northing:185020, longitude:-0.02201, latitude:51.54739},
    {id: 'H', easting:537267, northing:184783, longitude:-0.02185, latitude:51.54525},
    {id: 'I', easting:537269, northing:183451, longitude:-0.02234, latitude:51.53328},
    {id: 'J', easting:537270, northing:184140, longitude:-0.02206, latitude:51.53948},
    {id: 'K', easting:537356, northing:184927, longitude:-0.02052, latitude:51.54653},
    {id: 'L', easting:537380, northing:184727, longitude:-0.02025, latitude:51.54472},
    {id: 'M', easting:537458, northing:184495, longitude:-0.01921, latitude:51.54262},
    {id: 'N', easting:537604, northing:184134, longitude:-0.01725, latitude:51.53934},
    {id: 'O', easting:537720, northing:184057, longitude:-0.01561, latitude:51.53862},
    {id: 'P', easting:537905, northing:184591, longitude:-0.01273, latitude:51.54337},
    {id: 'Q', easting:537910, northing:184441, longitude:-0.01272, latitude:51.54202},
    {id: 'R', easting:537953, northing:184295, longitude:-0.01216, latitude:51.54070},
    {id: 'S', easting:538050, northing:184245, longitude:-0.01078, latitude:51.54023},
    
]

// These modules let us save the SVG file in the same folder as this script.
const fs = require('fs');
const path = require('path');
// The available frequencies and the distance used to check nearby cells.
const FREQUENCIES =[110,111,112,113,114,115];
const DISTANCE =600;

// Find the straight-line distance between two cells using their map coordinates.
function getDistance(cellA, cellB) {

    const xA= cellA.easting;
    const xB= cellB.easting;
    const yA= cellA.northing;
    const yB=cellB.northing;

    const dx = xB - xA;
    const dy = yB - yA;

    const distance = Math.sqrt(dx*dx + dy*dy);

    return distance;
}


// Give each cell a frequency that is not used by a nearby cell, if possible.
function getFrequencyAllocation (cells, freqencies, threshold)
{
    const allocation ={};

    // Check cells one at a time and keep track of frequencies already in use.
    cells.forEach(cell => {

        const usedFrequencies =new Set();

        // Find frequencies used by cells that have already been checked.
        cells.forEach(other => {
            if(cell.id !== other.id && allocation[other.id]){
                const dist =getDistance(cell,other);
                if (dist <= threshold){
                    usedFrequencies.add(allocation[other.id]);
                }
            }
        });

        const available = freqencies.filter(f => !usedFrequencies.has(f));

        // Use the first available frequency.
        if (available.length > 0) {
            allocation[cell.id] = available[0]
        }

        // If none are available, reuse a frequency from a distant cell.
        else {
            let furthestDist = -1;
            let fallbackFreq = freqencies[0];

            cells.forEach(other => {
                if (cell.id !== other.id && allocation[other.id]){
                    const dist =getDistance(cell, other);
                    if (dist > furthestDist)
                    {
                        furthestDist = dist;
                        fallbackFreq =allocation[other.id];
                    }
                }
            });
            allocation[cell.id] = fallbackFreq;
        }
        
    });
    return allocation;
}

// Make an SVG picture of the cells and their frequency assignments.
function generateSVG(cells, allocation, threshold) {
    const width = 800;
    const height = 600;
    // Work out the map bounds so the coordinates can fit inside the SVG.
    const padding = 40;
    const eastings = cells.map(cell => cell.easting);
    const northings = cells.map(cell => cell.northing);
    const minEasting = Math.min(...eastings);
    const maxEasting = Math.max(...eastings);
    const minNorthing = Math.min(...northings);
    const maxNorthing = Math.max(...northings);
    const scale = Math.min(
        (width - padding * 2) / (maxEasting - minEasting),
        (height - padding * 2) / (maxNorthing - minNorthing)
    );
    // Convert map coordinates to positions in the SVG, flipping the y direction.
    const mapPoint = cell => ({
        x: padding + (cell.easting - minEasting) * scale +
            (width - padding * 2 - (maxEasting - minEasting) * scale) / 2,
        y: height - padding - (cell.northing - minNorthing) * scale -
            (height - padding * 2 - (maxNorthing - minNorthing) * scale) / 2
    });

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    
    // Draw dashed lines between cells that are within the distance limit.
    for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
            let dx = cells[i].easting - cells[j].easting;
            let dy = cells[i].northing - cells[j].northing;
            let dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist <= threshold) {
                const start = mapPoint(cells[i]);
                const end = mapPoint(cells[j]);
                svg += `<line x1="${start.x}" y1="${start.y}" ` +
                       `x2="${end.x}" y2="${end.y}" ` +
                       `stroke="#9ca3af" stroke-dasharray="5 5" stroke-width="1.5" />`;
            }
        }
    }

    // Choose a different colour for each frequency.
    const colors = {
        110: "#ef4444",
        111: "#22c55e",
        112: "#f97316",
        113: "#8b5cf6",
        114: "#06b6d4",
        115: "#eab308"
    };

    // Draw a coloured circle and the cell's letter.
    for (let i = 0; i < cells.length; i++) {
        let c = cells[i];
        let freq = allocation[c.id];
        const point = mapPoint(c);
        const color = colors[freq] || "#3b82f6";

        svg += `<circle cx="${point.x}" cy="${point.y}" r="15" fill="${color}" />`;
        svg += `<text x="${point.x}" y="${point.y}" fill="white" ` +
               `text-anchor="middle" dominant-baseline="central" ` +
               `font-family="sans-serif" font-size="12">${c.id}</text>`;
    }

    svg += `</svg>`;
    return svg;
}

// Run the allocation and save the finished SVG file.
function main(){
    const allocation = getFrequencyAllocation(CELL_DATA, FREQUENCIES, DISTANCE);

    // Print each cell's assigned frequency in the terminal.
    for (const[id,freq] of Object.entries(allocation))
    {
        console.log (` ${id}  | ${freq}`);
    }

    // Create the SVG text and write it to a file.
    const svgContent = generateSVG(CELL_DATA, allocation, DISTANCE);
   fs.writeFileSync(path.join(__dirname, 'simple_frequency_map.svg'), svgContent);
   console.log("\n[Success] Generated SVG map: simple_frequency_map.svg");
}

main();