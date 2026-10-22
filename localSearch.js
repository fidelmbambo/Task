// This file tries to find a better set of frequencies for the cells.

// Find the distance between two cells.
function getDistance(cellA, cellB) {
    const dx = cellB.easting - cellA.easting;
    const dy = cellB.northing - cellA.northing;
    return Math.sqrt(dx * dx + dy * dy);
}

// Give the frequency plan a score from 0 to 100.
function scoreAllocation(cells, allocation, threshold) {
    let interference = 0;
    let maximumInterference = 0;

    // Cells closer together count more when checking interference.
    for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
            const distance = getDistance(cells[i], cells[j]);
            if (distance < threshold) {
                const weight = 1 - distance / threshold;
                maximumInterference += weight;

                if (allocation[cells[i].id] === allocation[cells[j].id]) {
                    interference += weight;
                }
            }
        }
    }

    if (maximumInterference === 0) {
        return { score: 100, interference: 0 };
    }

    const score = 100 * (1 - interference / maximumInterference);
    return { score, interference };
}

// Copy the plan before trying changes to it.
function copyAllocation(allocation) {
    return { ...allocation };
}

// Try different frequencies and keep the changes that improve the score.
function improveAllocation(cells, frequencies, threshold, startingAllocation) {
    const allocation = copyAllocation(startingAllocation);
    let currentScore = scoreAllocation(cells, allocation, threshold).score;
    let changes = 0;
    let improved = true;

    while (improved) {
        improved = false;
        let bestScore = currentScore;
        let bestCellId = null;
        let bestFrequency = null;

        for (const cell of cells) {
            const oldFrequency = allocation[cell.id];

            for (const frequency of frequencies) {
                if (frequency === oldFrequency) continue;

                allocation[cell.id] = frequency;
                const candidateScore = scoreAllocation(cells, allocation, threshold).score;
                if (candidateScore > bestScore + 1e-10) {
                    bestScore = candidateScore;
                    bestCellId = cell.id;
                    bestFrequency = frequency;
                }
            }

            allocation[cell.id] = oldFrequency;
        }

        if (bestCellId !== null) {
            allocation[bestCellId] = bestFrequency;
            currentScore = bestScore;
            changes++;
            improved = true;
        }
    }

    return { allocation, score: currentScore, changes };
}

// Try a few random changes and see if they help the plan get a better score.
function optimizeAllocation(cells, frequencies, threshold, startingAllocation, options = {}) {
    const restarts = options.restarts ?? 12;
    const randomChanges = options.randomChanges ?? Math.max(1, Math.ceil(cells.length * 0.15));
    const random = createRandom(options.seed ?? 42);

    let best = improveAllocation(cells, frequencies, threshold, startingAllocation);
    let totalChanges = best.changes;

    for (let restart = 0; restart < restarts; restart++) {
        const testAllocation = copyAllocation(best.allocation);

        // Pick some cells and give them random frequencies to try.
        for (let change = 0; change < randomChanges; change++) {
            const cell = cells[Math.floor(random() * cells.length)];
            const frequency = frequencies[Math.floor(random() * frequencies.length)];
            testAllocation[cell.id] = frequency;
        }

        const newResult = improveAllocation(cells, frequencies, threshold, testAllocation);
        totalChanges += newResult.changes;
        if (newResult.score > best.score + 1e-10) {
            best = newResult;
        }
    }

    return {
        allocation: best.allocation,
        score: best.score,
        interference: scoreAllocation(cells, best.allocation, threshold).interference,
        changes: totalChanges,
        restarts
    };
}

// Use the same random sequence each time so the result is repeatable.
function createRandom(seed) {
    let state = seed >>> 0;
    return function nextRandom() {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

module.exports = { optimizeAllocation, scoreAllocation };
