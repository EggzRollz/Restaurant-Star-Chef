// emailTemplate.js

/**
 * Generates the HTML string for the email.
 * @param {Object} data - Contains metrics, topItems, dates, etc.
 */
const generateEmailHtml = (data) => {
    const { 
        startDate, 
        endDate, 
        grossSales, 
        netSales, 
        totalOrders, 
        avgOrderValue, 
        onlineMetrics, 
        instoreMetrics, 
        topItemsRows 
    } = data;

    // --- CSS STYLES (Inlined for Email Compatibility) ---
    const styles = {
        body: "margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; color: #333;",
        container: "max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);",
        header: "background-color: #c7b884; padding: 30px 20px; text-align: center;",
        headerH1: "margin: 0; color: #fff; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;",
        section: "padding: 20px;",
        bigNumberText: "font-size: 28px; font-weight: 700; color: #2e7d32; margin-top: 5px;",
        subText: "font-size: 11px; color: #999;",
        tableHeader: "padding: 10px; text-align: left; color: #666; background-color: #f8f9fa;",
        cell: "padding: 12px 10px; border-bottom: 1px solid #eee;"
    };

    // --- HTML STRUCTURE ---
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
                <h1 style="${styles.headerH1}">Weekly Report</h1>
                <p style="margin: 5px 0 0; color: #fff; opacity: 0.9;">${startDate} - ${endDate}</p>
            </div>

            <!-- KEY METRICS -->
            <div style="${styles.section}">
                <table style="width: 100%; text-align: center; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 15px; border-right: 1px solid #eee; width: 50%;">
                            <div style="font-size: 12px; text-transform: uppercase; color: #777;">Gross Sales (w/ Tax)</div>
                            <div style="${styles.bigNumberText}">$${grossSales}</div>
                            <div style="${styles.subText}">Net Sales: $${netSales}</div>
                        </td>
                        <td style="padding: 15px; width: 50%;">
                            <div style="font-size: 12px; text-transform: uppercase; color: #777;">Total Orders</div>
                            <div style="font-size: 28px; font-weight: 700; color: #333; margin-top: 5px;">${totalOrders}</div>
                            <div style="${styles.subText}">Avg Order: $${avgOrderValue}</div>
                        </td>
                    </tr>
                </table>
            </div>

            <hr style="border: 0; border-top: 1px solid #eee; margin: 0;">

            <!-- BREAKDOWN TABLE -->
            <div style="padding: 25px 20px;">
                <h3 style="margin: 0 0 15px; font-size: 16px; color: #444; border-left: 4px solid #c7b884; padding-left: 10px;">💰 Sales Channels</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                        <th style="${styles.tableHeader}">Channel</th>
                        <th style="${styles.tableHeader}; text-align: center;">Orders</th>
                        <th style="${styles.tableHeader}; text-align: right;">Revenue</th>
                    </tr>
                    <tr>
                        <td style="${styles.cell}">
                            <strong>Online (Stripe)</strong>
                            <div style="font-size: 11px; color: #d32f2f;">Est. Fees: -$${onlineMetrics.fees}</div>
                        </td>
                        <td style="${styles.cell}; text-align: center;">${onlineMetrics.count}</td>
                        <td style="${styles.cell}; text-align: right;">$${onlineMetrics.gross}</td>
                    </tr>
                    <tr>
                        <td style="${styles.cell}"><strong>In-Store</strong></td>
                        <td style="${styles.cell}; text-align: center;">${instoreMetrics.count}</td>
                        <td style="${styles.cell}; text-align: right;">$${instoreMetrics.gross}</td>
                    </tr>
                </table>
            </div>

            <!-- TOP ITEMS -->
            <div style="padding: 0 20px 30px;">
                <h3 style="margin: 0 0 15px; font-size: 16px; color: #444; border-left: 4px solid #d32f2f; padding-left: 10px;">🔥 Top 5 Items</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    ${topItemsRows || '<tr><td style="padding: 10px;">No items sold.</td></tr>'}
                </table>
            </div>

            <div style="background-color: #333; color: #aaa; padding: 15px; text-align: center; font-size: 12px;">
                <p style="margin: 0;">Automated Report by Star Chef System</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

module.exports = { generateEmailHtml };