export const offerSheetTemplateHTML = `
<div class="offer-sheet-wrapper">
    <h1 style="text-align: center;">OFFER SHEET</h1>
    <div style="text-align: center; margin-bottom: 40px; font-size: 1.5em; font-weight: normal;"><mark>[seller_name]</mark></div>

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
        <table class="offer-table" style="width: 100%; border-collapse: collapse;">
            <colgroup>
                <col style="width: 12%;">
                <col style="width: 18%;">
                <col style="width: 30%;">
                <col style="width: 10%;">
                <col style="width: 15%;">
                <col style="width: 15%;">
            </colgroup>
            <thead>
                <tr>
                    <th style="background-color: #f3f4f6; font-weight: bold; padding: 8px; border: 1px solid #d1d5db; text-align: center;">Item No.</th>
                    <th style="background-color: #f3f4f6; font-weight: bold; padding: 8px; border: 1px solid #d1d5db; text-align: center;">HS-CODE</th>
                    <th style="background-color: #f3f4f6; font-weight: bold; padding: 8px; border: 1px solid #d1d5db; text-align: center;">Product</th>
                    <th style="background-color: #f3f4f6; font-weight: bold; padding: 8px; border: 1px solid #d1d5db; text-align: center;">Q'ty</th>
                    <th style="background-color: #f3f4f6; font-weight: bold; padding: 8px; border: 1px solid #d1d5db; text-align: center;">Unit Price</th>
                    <th style="background-color: #f3f4f6; font-weight: bold; padding: 8px; border: 1px solid #d1d5db; text-align: center;">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr style="height: 400px;">
                    <td style="padding: 10px; border: 1px solid #d1d5db; vertical-align: top; text-align: center;"><mark>[item_no]</mark></td>
                    <td style="padding: 10px; border: 1px solid #d1d5db; vertical-align: top; text-align: center;"><mark>[hscode]</mark></td>
                    <td style="padding: 10px; border: 1px solid #d1d5db; vertical-align: top;"><mark>[description]</mark></td>
                    <td style="padding: 10px; border: 1px solid #d1d5db; vertical-align: top; text-align: center;"><mark>[quantity]</mark></td>
                    <td style="padding: 10px; border: 1px solid #d1d5db; vertical-align: top; text-align: right;"><mark>[unit_price]</mark></td>
                    <td style="padding: 10px; border: 1px solid #d1d5db; vertical-align: top; text-align: right;"><mark>[sub_total_price]</mark></td>
                </tr>
            </tbody>
            <tfoot>
                <tr>
                    <td style="border: 1px solid #d1d5db; background-color: #f0f0f0;"></td>
                    <td style="border: 1px solid #d1d5db; background-color: #f0f0f0;"></td>
                    <td style="border: 1px solid #d1d5db; background-color: #f0f0f0;"></td>
                    <td style="border: 1px solid #d1d5db; background-color: #f0f0f0;"></td>
                    <td class="total-label" style="text-align: center; padding: 8px; border: 1px solid #d1d5db; border-right: none; background-color: #f0f0f0; font-weight: bold;">TOTAL :</td>
                    <td style="padding: 8px; border: 1px solid #d1d5db; border-left: none; text-align: right; background-color: #f0f0f0; font-weight: bold;"><mark>[total_price]</mark></td>
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
