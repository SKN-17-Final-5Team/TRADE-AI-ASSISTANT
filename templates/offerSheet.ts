// Offer Sheet Template as HTML string
export const offerSheetTemplateHTML = `
<div class="offer-sheet-wrapper">
    <h1 style="text-align: center;">OFFER SHEET</h1>
    <h2 style="text-align: center; margin-bottom: 40px;"><mark>[seller_name]</mark></h2>

    <!-- 상단 정보 -->
    <div class="meta">
        <div class="meta-row">
            <span class="meta-label">Date :</span> <mark>[offer_date]</mark>
        </div>
        <div class="meta-row">
            <span class="meta-label">Ref No. :</span> <mark>[offer_no]</mark>
        </div>
        <div class="meta-row">
            <span class="meta-label">MESSRS. :</span> <mark>[buyer_name]</mark>
        </div>
    </div>

    <p>We are pleased to offer you as follows;</p><p></p>

    <!-- 아이템 테이블 -->
    <div class="items-wrapper">
        <table class="offer-table">
            <thead>
                <tr>
                    <th style="width: 12%;">Item No.</th>
                    <th style="width: 18%;">HS-CODE</th>
                    <th style="width: 30%;">Product</th>
                    <th style="width: 10%;">Q'ty</th>
                    <th style="width: 15%;">Unit Price</th>
                    <th style="width: 15%;">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr style="height: 400px;">
                    <td style="vertical-align: top;"><mark>[item_no]</mark></td>
                    <td style="vertical-align: top;"><mark>[hscode]</mark></td>
                    <td style="vertical-align: top;"><mark>[description]</mark></td>
                    <td style="vertical-align: top;"><mark>[quantity]</mark></td>
                    <td style="vertical-align: top;"><mark>[unit_price]</mark></td>
                    <td style="vertical-align: top;"><mark>[sub_total_price]</mark></td>
                </tr>
            </tbody>
            <tfoot>
                <tr>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td class="total-label" style="text-align: center;">TOTAL :</td>
                    <td><mark>[total_price]</mark></td>
                </tr>
            </tfoot>
        </table>
    </div>

    <!-- 하단 조건들 -->
    <div class="detail-block"><p></p>
        <div class="detail-row">
            <span class="detail-label">Country of Origin</span> <mark>[coo]</mark>
        </div>
        <div class="detail-row">
            <span class="detail-label">Shipment</span> <mark>[shipment_term]</mark>
        </div>
        <div class="detail-row">
            <span class="detail-label">Inspection</span> <mark>[inspection]</mark>
        </div>
        <div class="detail-row">
            <span class="detail-label">Payment</span> <mark>[payment_term]</mark>
        </div>
        <div class="detail-row">
            <span class="detail-label">Validity</span> <mark>[offer_validity]</mark>
        </div>
        <div class="detail-row">
            <span class="detail-label">Remarks</span> <mark>[remarks]</mark>
        </div>
    </div>
    <p><p>

    <div class="signature">
        Sincerely yours,<br><br>
        <mark>[seller_name]</mark>
    </div>

    <div class="sign-line"></div>

    <div class="appendix">
        APPENDIX
    </div>
</div>
`;
