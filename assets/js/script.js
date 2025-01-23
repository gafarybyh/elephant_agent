// API KEY dan Spreadsheet ID
const SPREADSHEET_ID = "1PW67I8_1IFuvz5GBe-Gl8skCLzylRlOR8IWvv_mxCvI";

// Save to cache all fetching from API
const cachedData = {};
let dataTable;
let limitMedianActToken = 0;
let limitMedianActSector = 0;

const marketCapDropdown = document.getElementById("mcapDropdown");
const sortingDropdown = document.getElementById("sortingDropdown");
const dropdownButtonMcap = document.getElementById("mcap-dropdown-id");
const dropdownButtonSorting = document.getElementById("sorting-dropdown-id");
const currentPageTitle = document.getElementById("page-title-id");
const tableHeaders = document.getElementById("table-headers");
const tableRows = document.getElementById("table-rows");
const dataBodyId = document.getElementById("data-body");
const loadingId = document.getElementById("loadingAnimation");
const growthMcapCheck = document.getElementById("growth-mcap-id");
const top5TokenId = document.getElementById("top-5-id");
const top5TokenText = document.getElementById("top-5-text");
const btcPriceId = document.getElementById("btc-price-id");
const btcDomId = document.getElementById("btc-dom-id");
let top5TokenList = [];

// TODO FUNGSI TAMPIL ANIMASI LOADING
function showLoading({ isLoading }) {
    if (isLoading === true) {
        dataBodyId.style.display = "none";
        loadingId.style.display = "block";
    } else {
        dataBodyId.style.display = "block";
        loadingId.style.display = "none";
    }
}

// TODO MENGISI DATA KOSONG DENGAN "-" AGAR SESUAI DENGAN KOLOM HEADER
function normalizeData(headers, rows) {
    return rows.map((row) => {
        const normalizedRow = row.map((value) => {
            //* Cek apakah nilai adalah NaN atau kosong
            if (value === "NaN" || value === null || value === undefined) {
                return "-";
            }
            return value;
        });

        //* Add "-" jika panjang baris kurang dari jumlah header
        while (normalizedRow.length < headers.length) {
            normalizedRow.push("-");
        }

        return normalizedRow;
    });
}

// TODO FUNGSI FETCHING DATA DARI GOOGLE SHEET API
async function fetchAllData() {
    showLoading({ isLoading: true });

    const sheets = [
        { name: "Sector Category!A1:F", title: "Sector" },
        { name: "Tokens!A1:R", title: "Token Valuation" },
        { name: "Global Dominance", title: "Global Dominance" },
        { name: "Growth Degrowth", title: "Growth Degrowth" },
    ];

    try {
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

        // First value dropdown market cap
        dropdownButtonMcap.textContent = "Large Cap";

        cachedData["Token Valuation"].rows.map((col) => {
            if (col[0] === "Bitcoin") {
                const btcprice = parseFloat(col[1]);
                btcPriceId.textContent = `${btcprice.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0, // Tambahkan dua angka desimal
                })}`;
            }
        });

        const btcDom = parseFloat(cachedData["Global Dominance"].rows[0][2]);
        btcDomId.textContent = `${btcDom.toFixed(2)} %`;

        // Initialize table with first sheet
        initializeTable("Sector", (firstLoad = true));

        showLoading({ isLoading: false });
    } catch (error) {
        console.error("Failed to fetch data:", error);
        alert("Failed to fetch data from API. Please try again later.");
    }
}
//=======================================================

// TODO! KODE UTAMA INISIAL TABEL
function initializeTable(sheetTitle, { firstLoad }) {
    const data = cachedData[sheetTitle];

    if (!data) {
        console.error("No data found for:", sheetTitle);
        return;
    }

    //* Clear table
    tableHeaders.innerHTML = "";
    tableRows.innerHTML = "";

    //* Set page title
    currentPageTitle.textContent = sheetTitle;

    //* Jika dataTable sudah ada, hancurkan sebelum reinitializing
    if (dataTable) {
        dataTable.destroy();
        $("#data-table thead tr").empty();
        $("#data-table tbody").empty();
    }

    // Populate header tabel
    // data.headers.forEach((header) => {
    //     const th = document.createElement("th");
    //     th.textContent = header;
    //     tableHeaders.appendChild(th);
    // });

    //* Filter header berdasarkan kolom yang diatur
    data.headers
        .map((header) => {
            const index = data.headers.indexOf(header);
            if (index !== -1) {
                const thElement = document.createElement("th");
                thElement.textContent = header;
                tableHeaders.appendChild(thElement);
                return index; // Simpan indeks kolom
            }
            return -1;
        })
        .filter((index) => index !== -1);

    //* Populate rows tabel
    data.rows.forEach((row) => {
        const tr = document.createElement("tr");

        // Loop through each cell in the row
        for (let i = 0; i < data.headers.length; i++) {
            const td = document.createElement("td");
            td.textContent =
                row[i] !== null ||
                row[i] !== undefined ||
                row[i] !== "" ||
                row[i] !== NaN
                    ? row[i]
                    : "-"; // Ganti undefined dengan "-"

            tr.appendChild(td);
        }
        tableRows.appendChild(tr);
    });

    //* show dan hide dropdown market cap dan sorting
    showHideDropdown(sheetTitle);

    //* Kostum penampilan untuk baris tabel
    const currentTableTitle = currentPageTitle.textContent;

    //* Remove the default layout table
    DataTable.defaults.layout = {
        topStart: null,
        topEnd: null,
        bottomStart: null,
        bottomEnd: null,
    };

    //* Initialize DataTables
    dataTable = $("#data-table").DataTable({
        // dom: 'Bfrtip', // agar dapat kontrol layout table
        destroy: true,
        select: true,
        responsive: {
            details: {
                type: "column", // Tampilkan ikon di kolom tertentu
                target: "tr", // Baris menjadi interaktif
                renderer: function (api, rowIdx, columns) {
                    let data = $.map(columns, function (col, i) {
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
        // data: data.rows,
        columnDefs: tableLayout(currentTableTitle).setColumnPriority,
        columns: data.headers.map((header, index) => ({
            title: titleHeader(header), // Set text header sesuai dengan data
            render: (data, type, row) => {
                //* Format header pertama tabel
                if (index === 0) {
                    // Kolom pertama 0 atau header pertama
                    let tokenCol = `<strong>${data}</strong>`;
                    // Color top 5 token
                    top5TokenList.map((item) => {
                        if (item.token === data) {
                            tokenCol = `<strong class="warning">${data}</strong>`;
                        }
                    });

                    return tokenCol;
                }

                const numberValue = parseFloat(data);

                //* Format header currency
                if (
                    header === "Price" ||
                    header === "Total Volume" ||
                    header === "Volume 24h" ||
                    header === "Market Cap" ||
                    header === "FDV" ||
                    header === "BTC Price" ||
                    header === "BTC Volume" ||
                    header === "Global Marketcap" ||
                    header === "Global Volume"
                ) {
                    // Pastikan data berupa angka dan formatkan ke dollar
                    const formattedPrice = numberValue.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 2, // Tambahkan dua angka desimal
                    });
                    return `<span>${formattedPrice}</span>`;
                }

                //* Format angka biasa
                if (
                    header === "Circulating Supply" ||
                    header === "Total Supply"
                ) {
                    // Format angka dengan pemisah ribuan dan 2 angka desimal
                    const formattedNum = numberValue.toLocaleString("en-US", {
                        maximumFractionDigits: 0, // tanpa desimal
                    });

                    return `<span>${formattedNum}</span>`;
                }

                //* Format angka persen biasa
                if (
                    header === "Turnover (% Cirulating Supply Traded)" ||
                    header === "BTC Dominance" ||
                    header === "Turnover (% Cirulating Supply Traded)" ||
                    header === "BTC Vol. to Global Vol. Ratio"
                ) {
                    // Format angka dengan pemisah ribuan dan 2 angka desimal
                    const formattedNum = numberValue.toLocaleString("en-US", {
                        minimumFractionDigits: 2, // minimum 2 desimal
                    });

                    return `<span>${formattedNum} %</span>`;
                }

                //* Format ROI
                if (header === "ROI") {
                    if (!isNaN(numberValue)) {
                        return `<span">${numberValue} %</span>`;
                    }
                }

                //* Format warna Hype Activity Token
                if (header === "Hype Activity") {
                    // const cleanedTokenHypeActivity = data.replace(/[$,]/g, "");

                    if (!isNaN(numberValue)) {
                        return `<span class="${
                            numberValue >= limitMedianActToken
                                ? "positive"
                                : "warning"
                        }">${numberValue} %</span>`;
                    }
                }

                //* Format warna Activity Sector
                if (header === "Activity") {
                    // const cleanedSectorHypeActivity = data.replace(/[$,]/g, "");

                    if (!isNaN(numberValue)) {
                        return `<span class="${
                            numberValue >= limitMedianActSector
                                ? "positive"
                                : "warning"
                        }">${numberValue} %</span>`;
                    }
                }

                //* Format warna data persentase change
                if (
                    header === "Market Cap (Change 24h)" ||
                    header === "Price Changes 24h" ||
                    header === "Price Changes 7d" ||
                    header === "Price Changes 30d"
                ) {
                    if (!isNaN(numberValue)) {
                        return `<span class="${
                            numberValue > 0 ? "positive" : "negative"
                        }">${numberValue.toFixed(2)} %</span>`;
                    }
                }

                //* Warna Volatility 24h
                if (header === "Volatility 24h") {
                    if (!isNaN(numberValue) && numberValue >= 10) {
                        return `<span class= "negative">${numberValue.toFixed(
                            2
                        )} %</span>`;
                    } else if (
                        !isNaN(numberValue) &&
                        numberValue > 5 &&
                        numberValue < 10
                    ) {
                        return `<span class= "warning">${numberValue.toFixed(
                            2
                        )} %</span>`;
                    } else if (!isNaN(numberValue) && numberValue <= 5) {
                        return `<span class= "positive">${numberValue.toFixed(
                            2
                        )} %</span>`;
                    }
                }

                //* Warna Circulating To Supply Ratio
                if (header === "Circulating to Supply Ratio") {
                    if (!isNaN(numberValue) && numberValue >= 0.8) {
                        return `<span class= "positive">${numberValue.toFixed(
                            2
                        )}</span>`;
                    } else if (
                        !isNaN(numberValue) &&
                        numberValue > 0.501 &&
                        numberValue < 0.79999
                    ) {
                        return `<span class= "warning">${numberValue.toFixed(
                            2
                        )}</span>`;
                    } else if (!isNaN(numberValue) && numberValue <= 0.5) {
                        return `<span class= "negative">${numberValue.toFixed(
                            2
                        )}</span>`;
                    }
                }

                //* Format warna growth degrowth mcap
                if (
                    data === "Mid Cap → Small Cap" ||
                    data === "Large Cap → Mid Cap" ||
                    data === "Small Cap → Micro Cap"
                ) {
                    return `<span class="negative">${data}</span>`;
                } else if (
                    data === "Small Cap → Mid Cap" ||
                    data === "Mid Cap → Large Cap" ||
                    data === "Micro Cap → Small Cap"
                ) {
                    return `<span class="positive">${data}</span>`;
                }

                //* Format warna global dominance
                if (
                    header === "Signal Dominance" &&
                    (data === "BITCOIN" || data === "ALTCOIN")
                ) {
                    return `<span class="positive">${data}</span>`;
                } else if (
                    header === "Signal Dominance" &&
                    data === "HOLD STABLECOIN"
                ) {
                    return `<span class="warning">${data}</span>`;
                } else if (
                    header === "Signal Dominance" &&
                    data === "EXIT MARKET"
                ) {
                    return `<span class="percent-negative">${data}</span>`;
                }

                //*

                return data; // Default
            },
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
            // lengthMenu: "Tampilkan _MENU_ data",
            info: "_START_ - _END_ dari _TOTAL_",
        },
    });
}
//!========================END OF MAIN CODE===============================

// TODO  FUNGSI CUSTOM LAYOUT TABEL
function tableLayout(currentTableTitle) {
    let setColumnPriority = [];
    let orderBy = [];
    let ordering = true;

    //* Layout Sector
    if (currentTableTitle === "Sector") {
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

        //* Layout Kolom Token Valuation
    } else if (currentTableTitle === "Token Valuation") {
        orderBy = sortingToken(dropdownButtonSorting.textContent);

        setColumnPriority = [
            {
                responsivePriority: 1,
                targets: 0, // Kolom Tokens
                className: "text-wrap",
                orderable: false,
            },
            {
                responsivePriority: 2,
                targets: 4, // Kolom Mcap Change

                orderable: false,
            },
            {
                responsivePriority: 3,
                targets: -5, // Kolom Hype Activity

                orderable: false,
            },
            {
                responsivePriority: 4,
                targets: -6, // Kolom Turn Over
                orderable: false,
            },
            { targets: 1, orderable: false },
        ];

        //* Layout Kolom Global Dominance
    } else if (currentTableTitle === "Global Dominance") {
        orderBy = [0]; // default orderby Timestamp
        ordering = false;
        setColumnPriority = [
            {
                responsivePriority: 1,
                targets: 0, // Kolom Timestamp
                className: "text-wrap",
            },
            {
                responsivePriority: 2,
                targets: 2, // Kolom BTC DOM
                // className: "text-center",
            },
            {
                responsivePriority: 3,
                targets: -1, // Kolom Signal Dominance
                // className: "text-center",
            },
        ];

        //* Layout Kolom Growth Degrowth
    } else if (currentTableTitle === "Growth Degrowth") {
        orderBy = [0]; // default orderby timestamp
        setColumnPriority = [
            {
                responsivePriority: 1,
                targets: 0, // Kolom timestamp
                orderable: false,
                className: "text-wrap",
            },
            {
                responsivePriority: 2,
                targets: 1, // Kolom Token
                className: "text-wrap",
            },
            {
                responsivePriority: 3,
                targets: -1, // Kolom category change
                orderable: false,
            },
        ];
    }

    return { setColumnPriority, orderBy, ordering };
}

// TODO TOKEN VALUATION SORTING
function sortingToken(dropdownValue) {
    let sorting = [2, "desc"]; // default sorting volume

    if (dropdownValue === "Total Volume") {
        sorting = [2, "desc"];
    } else if (dropdownValue === "Market Cap") {
        sorting = [3, "desc"];
    } else if (dropdownValue === "Market Cap Change") {
        sorting = [4, "desc"];
    } else if (dropdownValue === "Hype Activity") {
        sorting = [13, "desc"];
    }
    return sorting;
}

// TODO FUNGSI CUSTOM NAMA HEADER TABEL
function titleHeader(titleTableHeader) {
    let titleHeader = titleTableHeader;

    if (titleTableHeader === "Market Cap (Change 24h)") {
        titleHeader = "MCap Chg 24h";
        return titleHeader;
    } else if (titleTableHeader === "BTC Dominance") {
        titleHeader = "BTC Dom";
        return titleHeader;
    } else if (titleHeader === "Turnover (% Cirulating Supply Traded)") {
        titleHeader = "Turnover (%)";
        return titleHeader;
    } else if (titleHeader === "Signal Dominance") {
        titleHeader = "Dominance";
        return titleHeader;
    }

    return titleHeader;
}
//=======================================================

// TODO FUNGSI GANTI PAGE DAN TABEL BERDASARKAN TITLE SHEET
function changeData(sheetTitle) {
    // ! jika page sama maka tidak panggil fungsi

    if (sheetTitle === currentPageTitle.textContent) {
        return;
    }

    showLoading({ isLoading: true });

    showHideDropdown(sheetTitle);

    if (!cachedData[sheetTitle]) {
        console.error("Data not found for:", sheetTitle);
        return;
    }

    initializeTable(sheetTitle, (firstLoad = false));

    setTimeout(() => {
        showLoading({ isLoading: false });
    }, 500); // 1000 milisecond = 1 detik
}
//=======================================================

// TODO FUNGSI MATIKAN SEARCHING PADA TABLE
function showHideSearch(sheetTitle) {
    let searchingOn = true;
    if (sheetTitle === "Sector" || sheetTitle === "Global Dominance") {
        searchingOn = false;
    }

    return searchingOn;
}
// =====================================================

// TODO SHOW HIDE DROPDOWN TOKEN VALUATION
function showHideDropdown(sheetTitle) {
    // Show dan Hide dropdown market cap dengan class: dropdown mb-4

    const sectionFilter = document.getElementById("section-filter");
    const sectionPerform = document.getElementById("section-perform");
    const sectionGlobalInfo = document.getElementById("section-global-info");

    // Jika token valuation, tampilkan dropdown market cap dan sorting
    if (sheetTitle === "Token Valuation") {
        sectionFilter.style.display = "block";
        sectionPerform.style.display = "block";
        sectionGlobalInfo.style.display = "block";
    } else if (sheetTitle === "Sector") {
        sectionFilter.style.display = "none";
        sectionPerform.style.display = "none";
        sectionGlobalInfo.style.display = "block";
    } else {
        sectionFilter.style.display = "none";
        sectionPerform.style.display = "none";
        sectionGlobalInfo.style.display = "none";
    }
}
//=======================================================

// TODO HANDLE FUNGSI DROPDOWN
document.addEventListener("DOMContentLoaded", function () {
    //* =================== MarketCap Dropdown =====================
    marketCapDropdown.addEventListener("click", function (event) {
        if (event.target && event.target.matches("a.dropdown-item")) {
            const selectedValue = event.target.getAttribute("data-value");
            const selectedText = event.target.textContent;
            // console.log("Selected Market Cap:", selectedValue);

            // Perbarui teks tombol dropdown dengan teks item yang dipilih
            dropdownButtonMcap.textContent = selectedText;

            // Lakukan sesuatu dengan nilai yang dipilih, misalnya panggil fungsi untuk memproses data

            showLoading({ isLoading: true });
            initializeTable("Token Valuation", (firstLoad = false));

            setTimeout(() => {
                showLoading({ isLoading: false });
            }, 300); // 1000 milisecond = 1 detik
        }
    });

    //* ================== Sorting Dropdown =================
    sortingDropdown.addEventListener("click", function (event) {
        if (event.target && event.target.matches("a.dropdown-item")) {
            const selectedValue = event.target.getAttribute("data-value");
            const selectedText = event.target.textContent;
            // console.log("Selected Sorting:", selectedValue);

            // Perbarui teks tombol dropdown dengan teks item yang dipilih
            dropdownButtonSorting.textContent = selectedText;

            // Lakukan sesuatu dengan nilai yang dipilih, misalnya panggil fungsi untuk memproses data
            showLoading({ isLoading: true });
            initializeTable("Token Valuation", (firstLoad = false));

            setTimeout(() => {
                showLoading({ isLoading: false });
            }, 300); // 1000 milisecond = 1 detik
        }
    });

    // *==================== ONLY GROWTH MCAP =====================
    var checkbox = growthMcapCheck;
    checkbox.addEventListener("change", function () {
        showLoading({ isLoading: true });
        initializeTable("Token Valuation", (firstLoad = false));

        setTimeout(() => {
            showLoading({ isLoading: false });
        }, 300); // 1000 milisecond = 1 detik
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
        for (let i = 0; i < data.length; i++) {
            // Hapus simbol $ dan koma
            // Ambil kolom 3 untuk marketcap
            // const cleanedNumMcap = data[i][3].replace(/[$,]/g, "");
            // const cleanedTokenHypeActivity = data[i][13].replace(/[$,]/g, "");

            //* Convert to desimal if data is string
            const marketcapNum = parseFloat(data[i][3]);
            const tokenHypeActivity = parseFloat(data[i][13]);
            const mcapChange = parseFloat(data[i][4]);

            //* Filter Market Cap
            if (marketCap === "Large Cap" && marketcapNum > 10000000000) {
                dataForTop5.push(data[i]);
                // If only positive mcap change
                if (onlyGrowthMcap.checked) {
                    if (mcapChange > 0) {
                        dataRow.push(data[i]);
                        tokenActivityData.push(tokenHypeActivity);
                    }
                } else {
                    dataRow.push(data[i]);
                    tokenActivityData.push(tokenHypeActivity);
                }
                tokenActivityData.push(tokenHypeActivity);
            } else if (
                marketCap === "Mid Cap" &&
                marketcapNum > 1000000000 &&
                marketcapNum <= 10000000000
            ) {
                dataForTop5.push(data[i]);
                // If only positive mcap change
                if (onlyGrowthMcap.checked) {
                    if (mcapChange > 0) {
                        dataRow.push(data[i]);
                        tokenActivityData.push(tokenHypeActivity);
                    }
                } else {
                    dataRow.push(data[i]);
                    tokenActivityData.push(tokenHypeActivity);
                }
                tokenActivityData.push(tokenHypeActivity);
            } else if (
                marketCap === "Small Cap" &&
                marketcapNum > 100000000 &&
                marketcapNum <= 1000000000
            ) {
                dataForTop5.push(data[i]);
                // If only positive mcap change
                if (onlyGrowthMcap.checked) {
                    if (mcapChange > 0) {
                        dataRow.push(data[i]);
                        tokenActivityData.push(tokenHypeActivity);
                    }
                } else {
                    dataRow.push(data[i]);
                    tokenActivityData.push(tokenHypeActivity);
                }
                tokenActivityData.push(tokenHypeActivity);
            } else if (marketCap === "Micro Cap" && marketcapNum <= 100000000) {
                dataForTop5.push(data[i]);
                // If only positive mcap change
                if (onlyGrowthMcap.checked) {
                    if (mcapChange > 0) {
                        dataRow.push(data[i]);
                        tokenActivityData.push(tokenHypeActivity);
                    }
                } else {
                    dataRow.push(data[i]);
                    tokenActivityData.push(tokenHypeActivity);
                }
                tokenActivityData.push(tokenHypeActivity);
            } else if (marketCap === "All Market Cap") {
                dataForTop5.push(data[i]);
                // If only positive mcap change
                if (onlyGrowthMcap.checked) {
                    if (mcapChange > 0) {
                        dataRow.push(data[i]);
                        tokenActivityData.push(tokenHypeActivity);
                    }
                } else {
                    dataRow.push(data[i]);
                    tokenActivityData.push(tokenHypeActivity);
                }
                tokenActivityData.push(tokenHypeActivity);
            }
        }

        //* Calculate Median & Mean
        if (
            marketCap === "Large Cap" ||
            marketCap === "Mid Cap" ||
            marketCap === "All Market Cap"
        ) {
            limitMedianActToken = calculateMedian(tokenActivityData);
        } else {
            limitMedianActToken = calculateAverage(tokenActivityData);
        }

        getHypeTokens(dataForTop5);
        return dataRow; // return data after filter

        // Kalkulasi untuk sector
    } else if (sheetTitle === "Sector") {
        for (let i = 0; i < data.length; i++) {
            dataRow.push(data[i]);
            // const cleanedSectorHypeActivity = data[i][4].replace(/[$,]/g, "");
            const sectorHypeActivity = parseFloat(data[i][4]);
            sectorActivityData.push(sectorHypeActivity);
        }
        limitMedianActSector = calculateMedian(sectorActivityData);
    } else {
        dataRow = data;
        return dataRow;
    }
}
// ====================================================

//TODO FUNGSI HYPE TOKEN
function getHypeTokens(data) {
    let marketCapChanges = [];
    let hypeActivityValues = [];

    // Kumpulkan semua nilai turnover dan market cap change
    for (let i = 0; i < data.length; i++) {
        const turnover = parseFloat(data[i][12]);
        const marketCapChange = parseFloat(data[i][4]);
        const hypeActivity = parseFloat(data[i][13]);

        if (!isNaN(marketCapChange)) marketCapChanges.push(marketCapChange);
        if (!isNaN(marketCapChange)) hypeActivityValues.push(hypeActivity);
    }

    // Hitung median atau rata-rata
    const marketCapChangeThreshold = calculateMedian(marketCapChanges);
    let hypeActivityThreshold = limitMedianActToken;

    let filteredTokens = [];

    // Filter data berdasarkan threshold
    for (let i = 0; i < data.length; i++) {
        const token = data[i][0];
        const marketCapChange = parseFloat(data[i][4]);
        const turnover = parseFloat(data[i][12]);
        const hypeActivity = parseFloat(data[i][13]);

        if (
            marketCapChange > marketCapChangeThreshold &&
            marketCapChange > 0 &&
            hypeActivity > hypeActivityThreshold
        ) {
            filteredTokens.push({
                token: token,
                marketCapChange: marketCapChange,
                turnover: turnover,
                hypeActivity: hypeActivity,
            });
        }
    }

    // Urutkan berdasarkan Hype Activity (descending)
    filteredTokens.sort((a, b) => b.hypeActivity - a.hypeActivity);

    // Ambil 5 token hype
    const top5Tokens = filteredTokens.slice(0, 5);
    top5TokenList = top5Tokens;

    top5TokenText.textContent = `Top ${top5TokenList.length} Hype ${dropdownButtonMcap.textContent} Tokens`;

    top5TokenId.textContent = top5Tokens
        .map((item) => `${item.token}`)
        .join(", ");
}

// TODO FUNGSI KALKULASI MEDIAN
function calculateMedian(arr) {
    // Pastikan data terurut
    arr.sort((a, b) => a - b); // Urutkan array dari kecil ke besar

    const n = arr.length; // Panjang array

    if (n % 2 === 0) {
        // Jika jumlah elemen genap, ambil rata-rata dari dua elemen tengah
        return (arr[n / 2 - 1] + arr[n / 2]) / 2;
    } else {
        // Jika jumlah elemen ganjil, ambil elemen tengah
        return arr[Math.floor(n / 2)];
    }
}

// =====================================================
// TODO FUNGSI KALKULASI  AVERAGE/MEAN
function calculateAverage(arr) {
    const sum = arr.reduce((a, b) => a + b, 0);
    return sum / arr.length;
}

// Fetch data on page load
document.addEventListener("DOMContentLoaded", fetchAllData);
