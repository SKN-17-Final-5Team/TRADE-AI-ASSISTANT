// Packing List Template as HTML string
export const packingListTemplateHTML = `
<div class="pl-wrapper">
    <h1>PACKING LIST</h1>
    <div class="title-underline"></div>

    <table class="header-table">
        <!-- Row 1 -->
        <tr>
            <td style="width: 50%;" rowspan="2">
                Date: <mark>[pl_date]</mark><br>
                Invoice No.: <mark>[invoice_no]</mark><br>
                Ref No.: <mark>[ref_no]</mark>
            </td>
            <td style="width: 50%;">
                <span class="label">No. &amp; Date of Invoice</span>
                <mark>[pl_no]</mark> / <mark>[pl_date]</mark>
            </td>
        </tr>
        <!-- Row 2 -->
        <tr>
            <td>
                <span class="label">No. &amp; Date of L/C</span>
                <mark>[l/c_no]</mark> / <mark>[l/c_date]</mark>
            </td>
        </tr>
        <!-- Row 3 -->
        <tr>
            <td style="height: 50px;">
                <span class="label">For Account &amp; Risk of Messrs.</span>
                <mark>[buyer_name]</mark><br>
                <mark>[buyer_address]</mark>
            </td>
            <td>
                <span class="label">Remarks</span>
                <mark>[remarks]</mark>
            </td>
        </tr>
        <!-- Row 4 -->
        <tr>
            <td style="height: 50px;">
                <span class="label">Notify party</span>
                <mark>[pl_notify_party]</mark><br>
                <mark>[pl_notify_party_address]</mark>
            </td>
            <td rowspan="3"></td> <!-- Empty right column for remaining rows -->
        </tr>
        <!-- Row 5: Split Left Column -->
        <tr>
            <td style="padding: 0; height: 50px;">
                <table style="width: 100%; height: 100%; border: none;">
                    <tr>
                        <td style="width: 50%; border: none; border-right: 1px solid #000;">
                            <span class="label">Port of loading</span>
                            <mark>[pol]</mark>
                        </td>
                        <td style="width: 50%; border: none;">
                            Port of Loading: <mark>[port_of_loading]</mark><br>
                            Final Destination: <mark>[final_destination]</mark><br>
                            Carrier: <mark>[carrier]</mark><br>
                            Sailing on or about: <mark>[sailing_date]</mark><br>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <!-- Row 6: Split Left Column -->
        <tr>
            <td style="padding: 0; height: 50px;">
                <table style="width: 100%; height: 100%; border: none;">
                    <tr>
                        <td style="width: 50%; border: none; border-right: 1px solid #000;">
                            <span class="label">Carrier</span>
                            <mark>[carrier]</mark>
                        </td>
                        <td style="width: 50%; border: none;">
                            <span class="label">Sailing on or about</span>
                            <mark>[shipment_deadline]</mark>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 30%;">Marks and Number of PKGS</th>
                <th style="width: 35%;">Description of Goods</th>
                <th style="width: 8%;">Q'ty</th>
                <th style="width: 9%;">Net Weight</th>
                <th style="width: 9%;">Gross Weight</th>
                <th style="width: 9%;">Measurement</th>
            </tr>
        </thead>
        <tbody>
            <!-- 20 Empty Rows -->
            <tr>
                <td style="vertical-align: top;"><mark>[marks_and_numbers]</mark></td>
                <td style="vertical-align: top;"><mark>[description]</mark></td>
                <td style="vertical-align: top;"><mark>[quantity]</mark></td>
                <td style="vertical-align: top;"><mark>[net_weight]</mark></td>
                <td style="vertical-align: top;"><mark>[gross_weight]</mark></td>
                <td style="vertical-align: top;"><mark>[measurement]</mark></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
        </tbody>
    </table>

    <table class="footer-table">
        <tr>
            <td style="width: 10%; text-align: right; font-weight: bold;">Total </td>
            <td style="width: 20%; font-weight: bold;"><mark>[cartons]</mark></td>
            <td style="width: 35%; text-align: center; font-weight: bold;">Total</td>
            <td style="width: 9%; text-align: center; font-weight: bold;"><mark>[total_net_weight]</mark>KG</td>
            <td style="width: 9%; text-align: center; font-weight: bold;"><mark>[total_gross_weight]</mark>KG</td>
            <td style="width: 9%; text-align: center; font-weight: bold;"><mark>[cbm]</mark>CBM</td>
            <br>
            
        </tr>
    </table>

    <div class="signature-section">
        Signed by <mark>[seller_name]</mark>
    </div>

    <div class="footer-info">
        H.S Code: <mark>[hscode]</mark><br>
        Trade Terms : <mark>[incoterms]</mark> <mark>[incoterms_port]</mark> incoterms2020
    </div>
</div>
`;
