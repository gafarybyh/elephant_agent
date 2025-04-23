/**
 * Elephant Screener - Data Visualization Tool
 *
 * This script handles data fetching, processing, and visualization for cryptocurrency market data.
 * It includes functions for filtering, sorting, and displaying data in tables with various metrics.
 */

//=============================================================================
// CONFIGURATION AND GLOBAL VARIABLES
//=============================================================================

/** API Configuration */
const SPREADSHEET_ID = "1PW67I8_1IFuvz5GBe-Gl8skCLzylRlOR8IWvv_mxCvI";

/** Data Storage */
const cachedData = {};        // Cache for API data
let dataTable;               // DataTable instance
let top5TokenList = [];      // List of top 5 tokens
let hypeTokenList = [];      // List of all hype tokens

/** Threshold Values */
let limitMedianActToken = 0;  // Median activity threshold for tokens
let limitMedianActSector = 0; // Median activity threshold for sectors

/** DOM Elements - UI Controls */
const marketCapDropdown = document.getElementById("mcapDropdown");
const sortingDropdown = document.getElementById("sortingDropdown");
const dropdownButtonMcap = document.getElementById("mcap-dropdown-id");
const dropdownButtonSorting = document.getElementById("sorting-dropdown-id");
const growthMcapCheck = document.getElementById("growth-mcap-id");

/** DOM Elements - Display Areas */
const currentPageTitle = document.getElementById("page-title-id");
const tableHeaders = document.getElementById("table-headers");
const tableRows = document.getElementById("table-rows");
const dataBodyId = document.getElementById("data-body");
const loadingId = document.getElementById("loadingAnimation");
const top5TokenId = document.getElementById("top-5-id");
const top5TokenText = document.getElementById("top-5-text");
const btcPriceId = document.getElementById("btc-price-id");
const btcDomId = document.getElementById("btc-dom-id");

//=============================================================================
// UTILITY FUNCTIONS
//=============================================================================

/**
 * Shows or hides the loading animation
 * @param {Object} options - Configuration options
 * @param {boolean} options.isLoading - Whether to show loading animation
 */
function showLoading({ isLoading }) {
    dataBodyId.style.display = isLoading ? "none" : "block";
    loadingId.style.display = isLoading ? "block" : "none";
}

/**
 * Normalizes data rows to ensure consistent format
 * @param {Array} headers - Array of header names
 * @param {Array} rows - Array of data rows
 * @returns {Array} - Normalized data rows
 */
function normalizeData(headers, rows) {
    const headerLength = headers.length;

    return rows.map(row => {
        // Normalize values in one pass
        const normalizedRow = row.map(value =>
            (value === "NaN" || value === null || value === undefined) ? "-" : value
        );

        // If row is shorter than headers, add missing values efficiently
        if (normalizedRow.length < headerLength) {
            return [...normalizedRow, ...Array(headerLength - normalizedRow.length).fill("-")];
        }

        return normalizedRow;
    });
}

/**
 * Calculates the median value of an array
 * @param {Array} arr - Array of numbers
 * @returns {number} - Median value
 */
function calculateMedian(arr) {
    // Handle edge cases
    if (!arr || arr.length === 0) return 0;
    if (arr.length === 1) return arr[0];

    // Create a copy to avoid modifying the original array
    const sortedArr = [...arr].sort((a, b) => a - b);
    const n = sortedArr.length;

    // Calculate median based on array length
    if (n % 2 === 0) {
        // Even length - average of middle elements
        return (sortedArr[n / 2 - 1] + sortedArr[n / 2]) / 2;
    } else {
        // Odd length - middle element
        return sortedArr[Math.floor(n / 2)];
    }
}

/**
 * Calculates the average value of an array
 * @param {Array} arr - Array of numbers
 * @returns {number} - Average value
 */
function calculateAverage(arr) {
    // Handle empty array
    if (!arr || arr.length === 0) return 0;

    // Calculate average in one line
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Detects outliers in a dataset using IQR method
 * @param {Array} data - Array of numbers
 * @returns {Object} - Object containing outlier information
 */
function calculateOutlier(data) {
    // Handle empty data
    if (!data || data.length === 0) {
        return {
            Q1: 0, Q3: 0, IQR: 0, lowerBound: 0, upperBound: 0,
            percentile90: 0, outliers: []
        };
    }

    // Create a sorted copy to avoid modifying original data
    const sortedData = [...data].sort((a, b) => a - b);

    // Helper function for quartile calculation with bounds checking
    function getQuartile(data, quartile) {
        const pos = (data.length - 1) * quartile;
        const base = Math.floor(pos);
        const rest = pos - base;

        // Prevent out-of-bounds access
        if (base + 1 < data.length) {
            return data[base] + rest * (data[base + 1] - data[base]);
        }
        return data[base];
    }

    // Calculate quartiles and IQR
    const Q1 = getQuartile(sortedData, 0.25);
    const Q3 = getQuartile(sortedData, 0.75);
    const IQR = Q3 - Q1;
    const lowerBound = Q1 - 1.5 * IQR;
    const upperBound = Q3 + 1.5 * IQR;

    // Calculate percentile with bounds checking
    const percentile90Index = Math.min(Math.ceil(0.9 * sortedData.length) - 1, sortedData.length - 1);
    const percentile90 = sortedData[Math.max(0, percentile90Index)];

    // Find outliers
    const outliers = sortedData.filter(x => x < lowerBound || x > upperBound);

    // Return only what's needed for better performance
    return {
        Q1,
        Q3,
        IQR,
        lowerBound,
        upperBound,
        percentile90,
        outliers
    };
}

//=============================================================================
// DATA FETCHING AND PROCESSING
//=============================================================================

/**
 * Fetches all data from Google Sheets API
 * Loads data for all sheets and initializes the first view
 */
async function fetchAllData() {
    showLoading({ isLoading: true });

    // Define sheets to fetch
    const sheets = [
        { name: "Sector Category!A1:F", title: "Sector" },
        { name: "Tokens!A1:R", title: "Token Valuation" },
        { name: "Global Dominance", title: "Global Dominance" },
        { name: "Growth Degrowth", title: "Growth Degrowth" },
    ];

    try {
        // Fetch all sheets in parallel
        await Promise.all(
            sheets.map(async (sheet) => {
                const url = `https://raynor-api.gafarybyh.workers.dev/sheets/${SPREADSHEET_ID}/${encodeURIComponent(
                    sheet.name
                )}`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.values) {
                    const headers = data.values[0];
                    const rows = normalizeData(headers, data.values.slice(1));
                    cachedData[sheet.title] = { headers, rows };
                } else {
                    console.warn(`No data found for sheet: ${sheet.title}`);
                }
            })
        );

        // Set initial UI state
        dropdownButtonMcap.textContent = "Large Cap";

        // Find Bitcoin price and update display
        const bitcoinData = cachedData["Token Valuation"].rows.find(row => row[0] === "Bitcoin");
        if (bitcoinData) {
            const btcprice = parseFloat(bitcoinData[1]);
            btcPriceId.textContent = btcprice.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0
            });
        }

        // Update BTC dominance display
        const btcDom = parseFloat(cachedData["Global Dominance"].rows[0][2]);
        btcDomId.textContent = `${btcDom.toFixed(2)} %`;

        // Initialize table with first sheet
        initializeTable("Sector", { firstLoad: true });

        showLoading({ isLoading: false });
    } catch (error) {
        console.error("Failed to fetch data:", error);
        alert("Failed to fetch data from API. Please try again later.");
        showLoading({ isLoading: false });
    }
}

//=============================================================================
// TABLE INITIALIZATION AND RENDERING
//=============================================================================

/**
 * Initializes and renders the data table
 * @param {string} sheetTitle - Title of the sheet to display
 * @param {Object} options - Configuration options
 * @param {boolean} options.firstLoad - Whether this is the first load
 */
function initializeTable(sheetTitle, { firstLoad }) {
    const data = cachedData[sheetTitle];

    if (!data) {
        console.error("No data found for:", sheetTitle);
        return;
    }

    // Clear existing table content
    tableHeaders.innerHTML = "";
    tableRows.innerHTML = "";

    // Update page title
    currentPageTitle.textContent = sheetTitle;

    // Destroy existing DataTable instance if it exists
    if (dataTable) {
        dataTable.destroy();
        $("#data-table thead tr").empty();
        $("#data-table tbody").empty();
    }

    // Populate table headers
    data.headers.forEach(header => {
        const thElement = document.createElement("th");
        thElement.textContent = header;
        tableHeaders.appendChild(thElement);
    });

    // Populate table rows
    data.rows.forEach(row => {
        const tr = document.createElement("tr");

        // Create cells for each value in the row
        for (let i = 0; i < data.headers.length; i++) {
            const td = document.createElement("td");
            td.textContent = (row[i] !== null && row[i] !== undefined && row[i] !== "" && !isNaN(row[i]))
                ? row[i]
                : "-";
            tr.appendChild(td);
        }

        tableRows.appendChild(tr);
    });

    // Update UI based on selected sheet
    showHideDropdown(sheetTitle);

    // Get table layout configuration
    const currentTableTitle = currentPageTitle.textContent;

    // Configure DataTable defaults if available
    if (typeof window.DataTable !== 'undefined') {
        window.DataTable.defaults.layout = {
            topStart: null,
            topEnd: null,
            bottomStart: null,
            bottomEnd: null,
        };
    }

    // Initialize DataTable with configuration
    dataTable = $("#data-table").DataTable({
        destroy: true,
        select: true,
        responsive: {
            details: {
                type: "column",
                target: "tr",
                renderer: function (_, __, columns) {
                    let data = $.map(columns, function (col) {
                        return col.hidden
                            ? `<tr data-dt-row="${col.rowIndex}" data-dt-column="${col.columnIndex}">
                                <td><strong>${col.title} :</strong></td>
                                <td>${col.data}</td>
                            </tr>`
                            : "";
                    }).join("");

                    return data ? $("<table/>").append(data) : false;
                },
            },
        },
        ordering: tableLayout(currentTableTitle).ordering,
        pageLength: currentTableTitle === "Token Valuation" ? 30 : 20,
        fixedHeader: true,
        lengthChange: false,
        searching: showHideSearch(currentTableTitle),
        order: [tableLayout(currentTableTitle).orderBy],
        data: firstLoad
            ? data.rows
            : filteredTableRow({ data: data.rows, sheetTitle: sheetTitle }),
        columnDefs: tableLayout(currentTableTitle).setColumnPriority,
        columns: data.headers.map((header, index) => ({
            title: titleHeader(header),
            render: (data, _, __) => formatCellContent(data, header, index)
        })),
        layout: {
            topEnd: {
                search: {
                    placeholder: "Token, DIP Status, Longterm Potential",
                },
            },
            top: ["pageLength"],
            bottom: ["info", "paging"],
        },
        language: {
            emptyTable: "No more data",
            search: "Search :",
            info: "_START_ - _END_ from _TOTAL_",
        },
    });
}

/**
 * Formats cell content based on column type
 * @param {*} data - Cell data
 * @param {string} header - Column header
 * @param {number} index - Column index
 * @returns {string} - Formatted HTML content
 */
function formatCellContent(data, header, index) {
    // Format first column (token names)
    if (index === 0) {
        let tokenCol = `<strong>${data}</strong>`;

        // Highlight tokens in the hype list
        hypeTokenList.forEach(item => {
            if (item.token === data) {
                tokenCol = `<strong class="warning">${data}</strong>`;
            }
        });

        return tokenCol;
    }

    const numberValue = parseFloat(data);

    // Format currency values
    const currencyColumns = [
        "Price", "Total Volume", "Volume 24h", "Market Cap", "FDV",
        "BTC Price", "BTC Volume", "Global Marketcap", "Global Volume"
    ];

    if (currencyColumns.includes(header)) {
        if (!isNaN(numberValue)) {
            const formattedPrice = numberValue.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2
            });
            return `<span>${formattedPrice}</span>`;
        }
    }

    // Format supply numbers
    if (header === "Circulating Supply" || header === "Total Supply") {
        if (!isNaN(numberValue)) {
            const formattedNum = numberValue.toLocaleString("en-US", {
                maximumFractionDigits: 0
            });
            return `<span>${formattedNum}</span>`;
        }
    }

    // Format percentage values
    const percentColumns = [
        "Turnover (% Cirulating Supply Traded)", "BTC Dominance",
        "BTC Vol. to Global Vol. Ratio"
    ];

    if (percentColumns.includes(header)) {
        if (!isNaN(numberValue)) {
            const formattedNum = numberValue.toLocaleString("en-US", {
                minimumFractionDigits: 2
            });
            return `<span>${formattedNum} %</span>`;
        }
    }

    // Format ROI
    if (header === "ROI" && !isNaN(numberValue)) {
        return `<span>${numberValue} %</span>`;
    }

    // Format Hype Activity with color
    if (header === "Hype Activity" && !isNaN(numberValue)) {
        const colorClass = numberValue >= limitMedianActToken ? "positive" : "warning";
        return `<span class="${colorClass}">${numberValue} %</span>`;
    }

    // Format Activity Sector with color
    if (header === "Activity" && !isNaN(numberValue)) {
        const colorClass = numberValue >= limitMedianActSector ? "positive" : "warning";
        return `<span class="${colorClass}">${numberValue} %</span>`;
    }

    // Format price changes with color
    const priceChangeColumns = [
        "Market Cap (Change 24h)", "Price Changes 24h",
        "Price Changes 7d", "Price Changes 30d"
    ];

    if (priceChangeColumns.includes(header) && !isNaN(numberValue)) {
        const colorClass = numberValue > 0 ? "positive" : "negative";
        return `<span class="${colorClass}">${numberValue.toFixed(2)} %</span>`;
    }

    // Format Volatility with color
    if (header === "Volatility 24h" && !isNaN(numberValue)) {
        let colorClass = "positive";
        if (numberValue >= 10) {
            colorClass = "negative";
        } else if (numberValue > 5) {
            colorClass = "warning";
        }
        return `<span class="${colorClass}">${numberValue.toFixed(2)} %</span>`;
    }

    // Format Circulating to Supply Ratio with color
    if (header === "Circulating to Supply Ratio" && !isNaN(numberValue)) {
        let colorClass = "negative";
        if (numberValue >= 0.8) {
            colorClass = "positive";
        } else if (numberValue > 0.501) {
            colorClass = "warning";
        }
        return `<span class="${colorClass}">${numberValue.toFixed(2)}</span>`;
    }

    // Format growth/degrowth with color
    const degrowthValues = ["Mid Cap → Small Cap", "Large Cap → Mid Cap", "Small Cap → Micro Cap"];
    const growthValues = ["Small Cap → Mid Cap", "Mid Cap → Large Cap", "Micro Cap → Small Cap"];

    if (degrowthValues.includes(data)) {
        return `<span class="negative">${data}</span>`;
    } else if (growthValues.includes(data)) {
        return `<span class="positive">${data}</span>`;
    }

    // Format Signal Dominance with color
    if (header === "Signal Dominance") {
        if (data === "BITCOIN" || data === "ALTCOIN") {
            return `<span class="positive">${data}</span>`;
        } else if (data === "HOLD STABLECOIN") {
            return `<span class="warning">${data}</span>`;
        } else if (data === "EXIT MARKET") {
            return `<span class="percent-negative">${data}</span>`;
        }
    }

    // Default return
    return data;
}

//=============================================================================
// TABLE CONFIGURATION HELPERS
//=============================================================================

/**
 * Determines table layout configuration based on the current table type
 * @param {string} currentTableTitle - The title of the current table
 * @returns {Object} - Configuration object for table layout
 */
function tableLayout(currentTableTitle) {
    let setColumnPriority = [];
    let orderBy = [];
    let ordering = true;

    // Configure column priorities and ordering based on table type
    switch (currentTableTitle) {
        case "Sector":
            orderBy = [2, "desc"];
            setColumnPriority = [
                {
                    responsivePriority: 1,
                    targets: 0,
                    orderable: false,
                    className: "text-wrap",
                },
                { responsivePriority: 2, targets: -3, className: "text-wrap" },
                { responsivePriority: 3, targets: -2 },
            ];
            break;

        case "Token Valuation":
            orderBy = sortingToken(dropdownButtonSorting.textContent);
            setColumnPriority = [
                {
                    responsivePriority: 1,
                    targets: 0, // Token name column
                    className: "text-wrap",
                    orderable: false,
                },
                {
                    responsivePriority: 2,
                    targets: 4, // Market Cap Change column
                    orderable: false,
                },
                {
                    responsivePriority: 3,
                    targets: -5, // Hype Activity column
                    orderable: false,
                },
                {
                    responsivePriority: 4,
                    targets: -6, // Turnover column
                    orderable: false,
                },
                { targets: 1, orderable: false },
            ];
            break;

        case "Global Dominance":
            orderBy = [0]; // Default order by Timestamp
            ordering = false;
            setColumnPriority = [
                {
                    responsivePriority: 1,
                    targets: 0, // Timestamp column
                    className: "text-wrap",
                },
                {
                    responsivePriority: 2,
                    targets: 2, // BTC Dominance column
                },
                {
                    responsivePriority: 3,
                    targets: -1, // Signal Dominance column
                },
            ];
            break;

        case "Growth Degrowth":
            orderBy = [0]; // Default order by timestamp
            setColumnPriority = [
                {
                    responsivePriority: 1,
                    targets: 0, // Timestamp column
                    orderable: false,
                    className: "text-wrap",
                },
                {
                    responsivePriority: 2,
                    targets: 1, // Token column
                    className: "text-wrap",
                },
                {
                    responsivePriority: 3,
                    targets: -1, // Category change column
                    orderable: false,
                },
            ];
            break;
    }

    return { setColumnPriority, orderBy, ordering };
}

/**
 * Determines sorting configuration for Token Valuation table
 * @param {string} dropdownValue - Selected sorting option
 * @returns {Array} - Sorting configuration array [columnIndex, direction]
 */
function sortingToken(dropdownValue) {
    // Default sorting by volume
    let sorting = [2, "desc"];

    // Set sorting based on selected option
    switch (dropdownValue) {
        case "Total Volume":
            sorting = [2, "desc"];
            break;
        case "Market Cap":
            sorting = [3, "desc"];
            break;
        case "Market Cap Change":
            sorting = [4, "desc"];
            break;
        case "Hype Activity":
            sorting = [13, "desc"];
            break;
    }

    return sorting;
}

/**
 * Formats table header titles for better display
 * @param {string} titleTableHeader - Original header title
 * @returns {string} - Formatted header title
 */
function titleHeader(titleTableHeader) {
    // Create a mapping of long headers to shorter versions
    const headerMap = {
        "Market Cap (Change 24h)": "MCap Chg 24h",
        "BTC Dominance": "BTC Dom",
        "Turnover (% Cirulating Supply Traded)": "Turnover (%)",
        "Signal Dominance": "Dominance"
    };

    // Return the mapped header or the original if not in the map
    return headerMap[titleTableHeader] || titleTableHeader;
}
//=============================================================================
// UI INTERACTION AND NAVIGATION
//=============================================================================

/**
 * Changes the displayed data based on the selected sheet
 * @param {string} sheetTitle - Title of the sheet to display
 */
function changeData(sheetTitle) {
    // Skip if already on the selected page
    if (sheetTitle === currentPageTitle.textContent) {
        return;
    }

    showLoading({ isLoading: true });

    // Update UI elements for the selected sheet
    showHideDropdown(sheetTitle);

    // Verify data exists
    if (!cachedData[sheetTitle]) {
        console.error("Data not found for:", sheetTitle);
        showLoading({ isLoading: false });
        return;
    }

    // Initialize table with the selected data
    initializeTable(sheetTitle, { firstLoad: false });

    // Hide loading after a short delay for better UX
    setTimeout(() => {
        showLoading({ isLoading: false });
    }, 500);
}

/**
 * Determines whether search functionality should be enabled for a table
 * @param {string} sheetTitle - The title of the sheet
 * @returns {boolean} - Whether search should be enabled
 */
function showHideSearch(sheetTitle) {
    // Disable search for Sector and Global Dominance tables
    return !(sheetTitle === "Sector" || sheetTitle === "Global Dominance");
}

/**
 * Shows or hides UI sections based on the selected sheet
 * @param {string} sheetTitle - The title of the sheet
 */
function showHideDropdown(sheetTitle) {
    // Get references to UI sections
    const sectionFilter = document.getElementById("section-filter");
    const sectionPerform = document.getElementById("section-perform");
    const sectionGlobalInfo = document.getElementById("section-global-info");

    // Configure UI based on selected sheet
    if (sheetTitle === "Token Valuation") {
        // Show all sections for Token Valuation
        sectionFilter.style.display = "block";
        sectionPerform.style.display = "block";
        sectionGlobalInfo.style.display = "block";
    } else if (sheetTitle === "Sector") {
        // Show only global info for Sector
        sectionFilter.style.display = "none";
        sectionPerform.style.display = "none";
        sectionGlobalInfo.style.display = "block";
    } else {
        // Hide all sections for other sheets
        sectionFilter.style.display = "none";
        sectionPerform.style.display = "none";
        sectionGlobalInfo.style.display = "none";
    }
}

/**
 * Initialize event listeners for UI interactions
 */
document.addEventListener("DOMContentLoaded", function () {
    // Market Cap Dropdown handler
    marketCapDropdown.addEventListener("click", function (event) {
        if (event.target && event.target.matches("a.dropdown-item")) {
            // Update dropdown button text
            dropdownButtonMcap.textContent = event.target.textContent;

            // Refresh table with new filter
            showLoading({ isLoading: true });
            initializeTable("Token Valuation", { firstLoad: false });

            setTimeout(() => {
                showLoading({ isLoading: false });
            }, 300);
        }
    });

    // Sorting Dropdown handler
    sortingDropdown.addEventListener("click", function (event) {
        if (event.target && event.target.matches("a.dropdown-item")) {
            // Update dropdown button text
            dropdownButtonSorting.textContent = event.target.textContent;

            // Refresh table with new sorting
            showLoading({ isLoading: true });
            initializeTable("Token Valuation", { firstLoad: false });

            setTimeout(() => {
                showLoading({ isLoading: false });
            }, 300);
        }
    });

    // Growth Market Cap checkbox handler
    growthMcapCheck.addEventListener("change", function () {
        // Refresh table with new filter
        showLoading({ isLoading: true });
        initializeTable("Token Valuation", { firstLoad: false });

        setTimeout(() => {
            showLoading({ isLoading: false });
        }, 300);
    });
});
//=======================================================

// TODO! FUNGSI FILTER DATA TABEL
function filteredTableRow({ data, sheetTitle }) {
    let dataRow = [];
    let dataForTop5 = [];
    let marketCap = dropdownButtonMcap.textContent;
    let tokenActivityData = [];
    let sectorActivityData = [];
    let onlyGrowthMcap = growthMcapCheck;

    // Kalkulasi untuk marketcap token valuation
    if (sheetTitle === "Token Valuation") {
        // Define market cap thresholds in a lookup object
        const marketCapThresholds = {
            "Large Cap": { min: 10000000000, max: Infinity },
            "Mid Cap": { min: 1000000000, max: 10000000000 },
            "Small Cap": { min: 100000000, max: 1000000000 },
            "Micro Cap": { min: 0, max: 100000000 },
            "All Market Cap": { min: 0, max: Infinity }
        };

        // Get threshold for current selection
        const threshold = marketCapThresholds[marketCap];

        // Process data in a single loop
        for (let i = 0; i < data.length; i++) {
            const marketcapNum = parseFloat(data[i][3]);
            const tokenHypeActivity = parseFloat(data[i][13]);
            const mcapChange = parseFloat(data[i][4]);

            // Check if token is in the selected market cap range
            if (marketcapNum >= threshold.min && marketcapNum < threshold.max) {
                // Add to top 5 data
                dataForTop5.push(data[i]);

                // Add to filtered data if it meets growth criteria
                if (!onlyGrowthMcap.checked || mcapChange > 0) {
                    dataRow.push(data[i]);
                    tokenActivityData.push(tokenHypeActivity);
                }

                // Always collect activity data for calculations
                tokenActivityData.push(tokenHypeActivity);
            }
        }

        // Calculate median or mean based on market cap category
        if (["Large Cap", "Mid Cap", "All Market Cap"].includes(marketCap)) {
            limitMedianActToken = calculateMedian(tokenActivityData);
        } else {
            limitMedianActToken = calculateAverage(tokenActivityData);
        }

        getHypeTokens(dataForTop5);
        return dataRow;

    // Kalkulasi untuk sector
    } else if (sheetTitle === "Sector") {
        // Process sector data more efficiently
        sectorActivityData = data.map(row => {
            dataRow.push(row);
            return parseFloat(row[4]); // Extract sector activity values
        }).filter(val => !isNaN(val)); // Filter out non-numeric values

        limitMedianActSector = calculateMedian(sectorActivityData);
        return dataRow;
    }

    // Default case - return data as is
    return data;
}
// ====================================================

//TODO FUNGSI HYPE TOKEN
function getHypeTokens(data) {
    // *NOTE
    // *Gunakan IQR untuk mendeteksi outlier.
    // *Gunakan Percentile (90th atau 95th) untuk mengidentifikasi token dengan perubahan besar.
    // *Gunakan Z-Score jika Anda yakin data memiliki distribusi mendekati normal.

    // Early return for empty data
    if (!data || data.length === 0) {
        top5TokenList = [];
        hypeTokenList = [];
        top5TokenText.textContent = `Top 0 Hype ${dropdownButtonMcap.textContent} Tokens`;
        top5TokenId.textContent = "";
        return;
    }

    // Extract values in a single pass using reduce
    const { marketCapChanges, hypeActivityValues } = data.reduce((acc, row) => {
        const marketCapChange = parseFloat(row[4]);
        const hypeActivity = parseFloat(row[13]);

        if (!isNaN(hypeActivity)) acc.hypeActivityValues.push(hypeActivity);
        if (!isNaN(marketCapChange)) acc.marketCapChanges.push(marketCapChange);

        return acc;
    }, { marketCapChanges: [], hypeActivityValues: [] });

    // Calculate outliers
    const outlierMcapChange = calculateOutlier(marketCapChanges);
    const outlierHypeToken = calculateOutlier(hypeActivityValues);

    // Filter tokens in a more efficient way
    const filteredTokens = [];
    const outlierSet = new Set(outlierMcapChange.outliers); // Use Set for faster lookups

    // Process data in a single loop
    data.forEach(row => {
        const token = row[0];
        const marketCapChange = parseFloat(row[4]);
        const turnover = parseFloat(row[12]);
        const hypeActivity = parseFloat(row[13]);

        // Check if this is an outlier token
        if (outlierSet.has(marketCapChange) &&
            marketCapChange > 0 &&
            hypeActivity > outlierHypeToken.upperBound) {

            filteredTokens.push({
                token,
                marketCapChange,
                turnover,
                hypeActivity
            });
        }
    });

    // Sort by hype activity (descending)
    filteredTokens.sort((a, b) => b.hypeActivity - a.hypeActivity);

    // Get top 5 tokens
    const top5Tokens = filteredTokens.slice(0, 5);
    top5TokenList = top5Tokens;
    hypeTokenList = filteredTokens;

    // Update UI
    top5TokenText.textContent = `Top ${top5TokenList.length} Hype ${dropdownButtonMcap.textContent} Tokens`;
    top5TokenId.textContent = top5Tokens.map(item => item.token).join(", ");
}

//=============================================================================
// APPLICATION INITIALIZATION
//=============================================================================

/**
 * Initialize the application when the DOM is fully loaded
 * Fetches all data and sets up the initial view
 */
document.addEventListener("DOMContentLoaded", function() {
    console.log("Elephant Screener initializing...");

    // Fetch all data from API
    fetchAllData();

    console.log("Initialization complete");
});
