export const commercialInvoiceTemplateHTML = `
<div class="ci-wrapper">
    <h1>COMMERCIAL INVOICE</h1>

    <div class="invoice-container">
        <!-- Row 1: Shipper & Invoice Details -->
        <div class="invoice-row">
            <div class="invoice-col" style="width: 50%;">
                <span class="label">Shipper / Exporter</span>
                <div class="content-area">
                    <mark>[seller_name]</mark><br>
                    <mark>[seller_address]</mark><br>
                    <mark>[seller_city]</mark>, <mark>[seller_country]</mark>
                    <br><br><br>
                </div>
            </div>
            <div class="invoice-col" style="width: 50%;">
                <div>
                    <span class="label">No. & Date of Invoice</span>
                    <div class="content-area"><mark>[ci_no]</mark> / <mark>[ci_date]</mark></div>
                </div>
                <div>
                    <span class="label">No. & Date of L/C</span>
                    <div class="content-area"><mark>[l/c_no]</mark> / <mark>[l/c_date]</mark></div>
                </div>
                <div>
                    <span class="label">L/C Issuing Bank</span>
                    <div class="content-area"><mark>[l/c_bank]</mark></div>
                </div>
            </div>
        </div>

        <!-- Row 2: Consignee & Remarks -->
        <div class="invoice-row">
            <div class="invoice-col" style="width: 50%;">
                <span class="label">Consignee</span>
                <div class="content-area">
                    <mark>[buyer_name]</mark><br>
                    <mark>[buyer_address]</mark><br>
                    <mark>[buyer_city]</mark>, <mark>[buyer_country]</mark>
                    <br><br>
                </div>
            </div>
            <div class="invoice-col" style="width: 50%;">
                <span class="label">Remarks</span>
                <div class="content-area">
                    <mark>[remarks]</mark><br>
                    <mark>[incoterms]</mark><mark>[incoterms_port]</mark>
                </div>
            </div>
        </div>

        <!-- Row 3: Notify Party -->
        <div class="invoice-row">
            <div class="invoice-col" style="width: 100%;">
                <span class="label">Notify Party</span>
                <div class="content-area">
                    <mark>[buyer_name]</mark><br>
                    <mark>[buyer_address]</mark><br>
                    (Same as Consignee)
                </div>
            </div>
        </div>

        <!-- Row 4: Shipping Details -->
        <div class="invoice-row">
            <div class="invoice-col" style="width: 25%;">
                <span class="label">Port of Loading</span>
                <div class="content-area"><mark>[pol]</mark></div>
            </div>
            <div class="invoice-col" style="width: 25%;">
                <span class="label">Final Destination</span>
                <div class="content-area"><mark>[final_destination]</mark></div>
            </div>
            <div class="invoice-col" style="width: 25%;">
                <span class="label">Carrier</span>
                <div class="content-area"><mark>[carrier]</mark></div>
            </div>
            <div class="invoice-col" style="width: 25%;">
                <span class="label">Sailing on or about</span>
                <div class="content-area"><mark>[shipment_deadline]</mark></div>
            </div>
        </div>

        <!-- Row 5: Goods Table -->
        <div class="invoice-row" style="display: block; padding: 0;">
            <table class="goods-table">
                <thead>
                    <tr>
                        <th rowspan="2" style="width: 15%;">Marks and Numbers</th>
                        <th rowspan="2" style="width: 30%;">Description of Goods</th>
                        <th colspan="3" style="width: 30%;">Quantity</th>
                        <th rowspan="2" style="width: 12.5%;">Unit Price</th>
                        <th rowspan="2" style="width: 12.5%;">Amount</th>
                    </tr>
                    <tr>
                        <th style="width: 8.33%;">EA/BOX</th>
                        <th style="width: 8.33%;">Box</th>
                        <th style="width: 8.33%;">Total EA</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <mark>[marks_and_numbers]</mark>
                        </td>
                        <td>
                            <mark>[description]</mark>
                        </td>
                        <td style="text-align: center;">
                            <mark>[ea_box]</mark>
                        </td>
                        <td style="text-align: center;">
                            <mark>[box]</mark>
                        </td>
                        <td style="text-align: center;">
                            <mark>[quantity]</mark>
                        </td>
                        <td style="text-align: right;">
                            <mark>[unit_price]</mark>/</br><mark>[currency]</mark>
                        </td>
                        <td style="text-align: right;">
                            <mark>[sub_total_price]</mark><mark>[currency]</mark>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Row 6: Totals -->
        <div class="invoice-row" style="background-color: #f0f0f0; font-weight: bold;">
            <div class="invoice-col" style="width: 50%; text-align: right; border-right: none;">
                TOTAL :
            </div>
            <div class="invoice-col" style="width: 8.33%; text-align: center; border-right: none;">
                <mark>[ea/box]</mark>
            </div>
            <div class="invoice-col" style="width: 8.33%; text-align: center; border-right: none;">
                <mark>[box]</mark>
            </div>
            <div class="invoice-col" style="width: 8.33%; text-align: center; border-right: none;">
                <mark>[quantity]</mark>
            </div>
            <div class="invoice-col" style="width: 25%; text-align: right;">
                <mark>[total_price]</mark><mark>[currency]</mark>
            </div>
        </div>

        <!-- Row 7: Signature -->
        <div class="invoice-row" style="border-bottom: none;">
            <div class="invoice-col" style="width: 100%; padding: 40px 20px 20px 20px; text-align: right;">
                <span style="font-weight: bold; font-size: 9pt;">Signed by :</span>
                <br><br>
                ____________________________________<br>
                Authorized Signature
            </div>
        </div>

    </div>
</div>
`;
