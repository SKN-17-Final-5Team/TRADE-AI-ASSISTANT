// Purchase Order Template as HTML string
export const purchaseOrderTemplateHTML = `
<div class="po-wrapper">
    <!-- 회사 정보 -->
    <div class="po-company">
      <div class="po-company-name"><mark>[buyer_name]</mark></div>
      <div class="po-company-info">
        <mark>[buyer_address]</mark><br />
        <mark>[buyer_number]</mark>, <mark>[buyer_fax]</mark>, <mark>[buyer_homepage]</mark>
      </div>
    </div>

    <!-- 제목 -->
    <div class="po-title">Purchase Order</div>

    <!-- 수신인 / 날짜, 레퍼런스 -->
    <div class="po-meta">
      <div class="po-meta-block">
                Company Name: <mark>[seller_name]</mark><br>
                Name/Department: <mark>[seller_human_name]</mark><mark>[seller_department]</mark><br>
                Address: <mark>[seller_address]</mark><br>
                City/Postal Code: <mark>[seller_city]</mark><mark>[seller_postal_code]</mark><br>
                Country: <mark>[seller_country]</mark><br>
                Tel./Fax No.: <mark>[seller_fax]</mark>/<mark>[seller_fax]</mark>
      </div>
      <div class="po-meta-block po-date-ref">
        <div class="po-meta-row"><span class="po-label">Date:</span> <span class="po-value"><mark>[po_date]</mark></span></div>
        <div class="po-meta-row"><span class="po-label">PO No.:</span> <span class="po-value"><mark>[po_no]</mark></span></div>
      </div>
    </div>

    <!-- 본문 -->
    <div class="po-body">
      Dear Sir,<br /><br />
      We, as buyer, hereby confirm our purchase from you as Seller of the
      following goods in accordance with the terms and conditions given below
      and on the back hereof.
    </div>

    <!-- 조건/내역 -->
    <div class="po-terms">
      <div class="term-row">
        <div class="term-label">Description</div>
        <td style="vertical-align: top;"><mark>[description]</mark></td>
      </div>
      <div class="term-row">
        <div class="term-label">Quantity</div>
        <td style="vertical-align: top;"><mark>[quantity]</mark></td>
      </div>
      <div class="term-row">
        <div class="term-label">Unit Price</div>
        <td style="vertical-align: top;"><mark>[unit_price]</mark>/<mark>[unit]</mark> <mark>[currency]</mark></td>
      </div>
      <div class="term-row">
        <div class="term-label">Total amount</div>
            <td style="vertical-align: middle;"><mark>[total_price]</mark><mark>[currency]</mark></td>
      </div>
      <div class="term-row">
        <div class="term-label">Payment</div>
        <div class="term-value"><mark>[payment_term]</mark></div>
      </div>
      <div class="term-row">
        <div class="term-label">Shipment</div>
        <div class="term-value"><mark>[shipment_deadline]</mark></div>
      </div>
      <div class="term-row">
        <div class="term-label">POL/POD</div>
        <div class="term-value"><mark>[pol]</mark> / <mark>[pod]</mark></div>
      </div>
      <div class="term-row">
        <div class="term-label">Insurance</div>
        <div class="term-value"><mark>[insurance_term]</mark></div>
      </div>
      <div class="term-row">
        <div class="term-label">Inspection</div>
        <div class="term-value"><mark>[inspection_requirement]</mark></div>
      </div>
      <div class="term-row">
        <div class="term-label">Packing</div>
        <div class="term-value"><mark>[packing_requirement]</mark></div>
      </div>
      <div class="term-row">
        <div class="term-label">Marks</div>
        <div class="term-value"><mark>[shipping_marks]</mark></div>
      </div>
    </div>

    <!-- 서명 -->
    <div class="po-sign">
      <div class="po-sign-title">CONFIRMED &amp; ACCEPTED BY:</div>

      <table class="po-sign-table">
        <tr>
          <td>
            <mark>[seller_name]</mark>
            <div class="po-sign-line">
                <span class="po-sign-name"><mark>[seller_human_name]</mark></span>
                <span class="po-sign-role"><mark>[seller_human_position]</mark></span>
            </div>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-block; text-align: left; width: 80%;">
                <mark>[buyer_name]</mark>
                <div class="po-sign-line" style="width: 100%;">
                    <span class="po-sign-name"><mark>[buyer_human_name]</mark></span>
                    <span class="po-sign-role"><mark>[buyer_human_department]</mark></span>
                </div>
            </div>
          </td>
        </tr>
      </table>
    </div>
</div>
`;
