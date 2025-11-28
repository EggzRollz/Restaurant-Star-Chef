// emailTemplate.js

const formatMoney = (amount) => Number(amount).toFixed(2);

const getTrendHtml = (percent) => {
    const isPositive = percent >= 0;
    const color = isPositive ? '#2e7d32' : '#d32f2f'; // Green : Red
    const arrow = isPositive ? '▲' : '▼';
    if (isNaN(percent) || !isFinite(percent)) return `<span style="color: #999; font-size: 11px;">(0%)</span>`;
    return `<span style="color: ${color}; font-size: 11px; font-weight: bold;">${arrow} ${Math.abs(percent).toFixed(1)}%</span>`;
};

const generateEmailHtml = (data) => {
    const { 
        startDate, endDate, 
        grossSales, netSales, 
        totalOrders, avgOrderValue, 
        onlineMetrics, instoreMetrics, 
        topItemsRows,
        chartUrl, 
        comparisons 
    } = data;

    const styles = {
        body: "margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; color: #333;",
        container: "max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);",
        header: "background-color: #c7b884; padding: 30px 20px; text-align: center;", 
        headerH1: "margin: 0; color: #fff; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;",
        section: "padding: 20px;",
        bigNumberText: "font-size: 28px; font-weight: 700; color: #2e7d32; margin-top: 5px;",
        subText: "font-size: 28px; font-weight: 700; margin-top: 5px; color: #777;",
        tableHeader: "padding: 10px; text-align: left; color: #666; background-color: #f8f9fa; font-size: 12px; text-transform: uppercase;",
        cell: "padding: 12px 10px; border-bottom: 1px solid #eee;"
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="${styles.body}">
        <div style="${styles.container}">
            
            <!-- HEADER -->
            <div style="${styles.header}">
                <h1 style="${styles.headerH1}">Weekly Performance</h1>
                <p style="margin: 5px 0 0; color: #ccc; font-size: 14px;">${startDate} - ${endDate}</p>
            </div>

            <!-- KEY METRICS ROW -->
            <div style="${styles.section}">
                <table style="width: 100%; text-align: center; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 15px; border-right: 1px solid #eee; width: 50%;">
                            <div style="font-size: 11px; text-transform: uppercase; color: #999; letter-spacing: 0.5px;">Gross Revenue</div>
                            <div style="${styles.bigNumberText}">$${formatMoney(grossSales)}</div>
                            <div style="margin-top: 5px;">
                                ${getTrendHtml(comparisons.salesChange)} <span style="font-size: 11px; color: #999;">vs last wk</span>
                            </div>
                        </td>
                        <td style="padding: 15px; width: 50%;">
                            <div style="font-size: 11px; text-transform: uppercase; color: #999; letter-spacing: 0.5px;">Total Orders</div>
                            <div style="${styles.subText}">${totalOrders}</div>
                            <div style="margin-top: 5px;">
                                ${getTrendHtml(comparisons.ordersChange)} <span style="font-size: 11px; color: #999;">vs last wk</span>
                            </div>
                        </td>
                    </tr>
                </table>
                <div style="text-align: center; margin-top: 15px; font-size: 12px; color: #999;">
                    Net Sales: <strong>$${formatMoney(netSales)}</strong> | Avg Ticket: <strong>$${avgOrderValue}</strong>
                </div>
            </div>

            <hr style="border: 0; border-top: 1px solid #eee; margin: 0;">

            <!-- CHART SECTION -->
            <div style="padding: 20px; text-align: center;">
                 <h3 style="margin: 0 0 15px; font-size: 14px; color: #444; text-align: left; border-left: 3px solid #1a1a1a; padding-left: 10px;">📈 7-Day Sales Trend</h3>
                 <img src="${chartUrl}" alt="Sales Graph" style="width: 100%; max-width: 500px; height: auto; border-radius: 4px; border: 1px solid #eee;">
            </div>

            <hr style="border: 0; border-top: 1px solid #eee; margin: 0;">

            <!-- CHANNEL BREAKDOWN -->
            <div style="padding: 25px 20px;">
                <h3 style="margin: 0 0 15px; font-size: 14px; color: #444; border-left: 3px solid #c7b884; padding-left: 10px;">💰 Sales Channels</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                        <th style="${styles.tableHeader}">Channel</th>
                        <th style="${styles.tableHeader}; text-align: center;">Orders</th>
                        <th style="${styles.tableHeader}; text-align: right;">Gross</th>
                    </tr>
                    <tr>
                        <td style="${styles.cell}">
                            <strong>Online Orders</strong>
                            <!-- RE-ADDED THIS LINE -->
                            <div style="font-size: 11px; color: #d32f2f; margin-top: 2px;">Est. Fees: -$${onlineMetrics.fees}</div>
                        </td>
                        <td style="${styles.cell}; text-align: center;">${onlineMetrics.count}</td>
                        <td style="${styles.cell}; text-align: right;">$${formatMoney(onlineMetrics.gross)}</td>
                    </tr>
                    <tr>
                        <td style="${styles.cell}"><strong>In-Store / POS</strong></td>
                        <td style="${styles.cell}; text-align: center;">${instoreMetrics.count}</td>
                        <td style="${styles.cell}; text-align: right;">$${formatMoney(instoreMetrics.gross)}</td>
                    </tr>
                </table>
            </div>

            <!-- TOP ITEMS -->
            <div style="padding: 0 20px 30px;">
                <h3 style="margin: 0 0 15px; font-size: 14px; color: #444; border-left: 3px solid #d32f2f; padding-left: 10px;">🔥 Top Sellers (Qty)</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    ${topItemsRows || '<tr><td style="padding: 10px;">No items sold.</td></tr>'}
                </table>
            </div>

            <div style="background-color: #f1f1f1; color: #999; padding: 20px; text-align: center; font-size: 11px; border-top: 1px solid #eee;">
                <p style="margin: 0;">Automated Report by Star Chef System</p>
                <p style="margin: 5px 0 0;">Generated on ${new Date().toLocaleDateString()}</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

module.exports = { generateEmailHtml };