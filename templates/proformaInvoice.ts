// Proforma Invoice Template as HTML string
export const proformaInvoiceTemplateHTML = `
<div class="pi-wrapper">
    <h1>PROFORMA INVOICE</h1>
    <div class="header-line"></div>

    <table>
        <!-- Proforma Invoice Header -->
        <tr>
            <td colspan="6" class="section-header" style="background-color: #D3D3D3;">Proforma Invoice</td>
        </tr>
        <tr>
            <td colspan="6">
                Date: <mark>[pi_date]</mark><br>
                Proforma invoice : <mark>[pi_no]</mark>
            </td>
        </tr>

        <!-- SENT BY -->
        <tr>
            <td colspan="6" class="section-header" style="background-color: #D3D3D3;">SENT BY</td>
        </tr>
        <tr>
            <td colspan="6" class="content-cell">
                Company Name: <mark>[seller_name]</mark><br>
                Name/Department: <mark>[seller_human_name]</mark><mark>[seller_department]</mark><br>
                Address: <mark>[seller_address]</mark><br>
                City/Postal Code: <mark>[seller_city]</mark><mark>[seller_postal_code]</mark><br>
                Country: <mark>[seller_country]</mark><br>
                Tel./Fax No.: <mark>[seller_fax]</mark>/<mark>[seller_fax]</mark>
            </td>
        </tr>

        <!-- SENT TO & Bill of Lading No -->
        <tr>
            <td colspan="3" class="section-header" style="width: 50%; background-color: #D3D3D3;">SENT TO</td>
            <td colspan="3" class="section-header" style="width: 50%; background-color: #D3D3D3;">Bill of Lading No</td>
        </tr>
        <tr>
            <td colspan="3" class="content-cell">
                Company Name: <mark>[buyer_name]</mark><br>
                Name/Department: <mark>[buyer_human_name]</mark>/<mark>[buyer_human_department]</mark><br>
                Address: <mark>[buyer_address]</mark><br>
                City/Postal Code: <mark>[buyer_city]</mark><br>
                Country: <mark>[buyer_country]</mark><br>
                Tel: <mark>[buyer_number]</mark>
            </td>
            <td colspan="3" class="content-cell">
                Number of pieces: <mark>[quantity]</mark><br>
                Total Gross Weight: <mark>[total_gross_weight]</mark><br>
                Total Net Weight: <mark>[total_net_weight]</mark><br>
                Carrier: <mark>[carrier]</mark>
            </td>
        </tr>

        <!-- Items Header -->
        <tr class="items-header">
            <td style="width: 25%;">Description of goods</td>
            <td style="width: 15%;">Commodity Code</td>
            <td style="width: 15%;">Country of origin</td>
            <td style="width: 10%;">Quantity</td>
            <td style="width: 15%;">Unit Value, Currency</td>
            <td style="width: 20%;">Subtotal value, Currency</td>
        </tr>

        <!-- Items Body -->
        <tr class="items-body">
            <td style="vertical-align: top;"><mark>[description]</mark></td>
            <td style="vertical-align: top;"><mark>[hscode]</mark></td>
            <td style="vertical-align: top;"><mark>[coo]</mark></td>
            <td style="vertical-align: top;"><mark>[quantity]</mark></td>
            <td style="vertical-align: top;"><mark>[unit_price]</mark>/<mark>[unit]</mark> <mark>[currency]</mark></td>
            <td style="vertical-align: top;"><mark>[sub_total_price]</mark><mark>[currency]</mark></td>
        </tr>

        <!-- Total Footer -->
        <tr>
            <td colspan="5" style="text-align: right; vertical-align: middle;">Total value, currency</td>
            <td style="vertical-align: middle;"><mark>[total_price]</mark><mark>[currency]</mark></td>
        </tr>
    </table>

    <div class="footer-section">
        <div class="footer-row">
            <div class="footer-item">Term of transportation: <mark>[transportation_term]</mark></div>
            <div class="footer-item" style="text-align: right;">Reason for export: <mark>[export_reason]</mark></div>
        </div>

        <div class="declaration">
            I declare that the information mentioned above is true and correct to the best of my knowledge.
        </div>

        <div class="signature-row">
            <div class="footer-item">Signature: </div>
            <div class="footer-item stamp-item">Stamp:</div>
        </div>

        <div style="margin-top: 40px;">
        Name: <mark>[seller_name]</mark>
        </div>
    </div>
</div>
`;
