// Sale Contract Template as HTML string
// Using HTML is more reliable than JSON for complex documents with tables
export const saleContractTemplateHTML = `
<h1 style="text-align: center">Sale Contract</h1>

<h2 style="text-align: center">Specific Conditions</h2>

<p>The purpose of this contract is to stipulate the rights, obligations, and all matters of both parties necessary for <mark>[SUPPLIER_NAME]</mark> (hereinafter referred to as "Supplier") and <mark>[BUYER_NAME]</mark> (hereinafter referred to as "Buyer") to sign the Overseas distribution contract for the distribution of the following goods. 'Supplier' and 'Buyer' are hereinafter referred to as "Parties to the Contract" or "Parties".</p>

<h3>Products</h3>

<table>
  <tr>
    <th>Item No.</th>
    <th>Commodity & Description</th>
    <th>Quantity</th>
    <th>Unit Price</th>
    <th>Total</th>
    <th>Notice</th>
  </tr>
  <tr>
    <td>1</td>
    <td><mark>[PRODUCT_1]</mark></td>
    <td><mark>[QTY_1]</mark></td>
    <td><mark>[PRICE_1]</mark></td>
    <td><mark>[TOTAL_1]</mark></td>
    <td></td>
  </tr>
  <tr>
    <td>2</td>
    <td><mark>[PRODUCT_2]</mark></td>
    <td><mark>[QTY_2]</mark></td>
    <td><mark>[PRICE_2]</mark></td>
    <td><mark>[TOTAL_2]</mark></td>
    <td></td>
  </tr>
  <tr>
    <td>3</td>
    <td><mark>[PRODUCT_3]</mark></td>
    <td><mark>[QTY_3]</mark></td>
    <td><mark>[PRICE_3]</mark></td>
    <td><mark>[TOTAL_3]</mark></td>
    <td></td>
  </tr>
  <tr>
    <td colspan="4"><strong>Total</strong></td>
    <td><strong><mark>[GRAND_TOTAL]</mark></strong></td>
    <td></td>
  </tr>
</table>

<h3>Shipment Details</h3>

<ul>
  <li><strong>Time of Shipment:</strong> By <mark>[SHIPMENT_DATE]</mark></li>
  <li><strong>Cancellation Date for Late Shipment:</strong> <mark>[CANCELLATION_DATE]</mark></li>
  <li><strong>Port of Shipment:</strong> <mark>[PORT_OF_SHIPMENT]</mark></li>
  <li><strong>Port of Destination:</strong> <mark>[PORT_OF_DESTINATION]</mark></li>
  <li><strong>Partial Shipment:</strong> <mark>[PARTIAL_SHIPMENT]</mark></li>
  <li><strong>Transhipment:</strong> <mark>[TRANSHIPMENT]</mark></li>
  <li><strong>Delivery Terms:</strong> <mark>[DELIVERY_TERMS]</mark> Incoterms 2020</li>
</ul>

<h3>Payment</h3>

<p><strong>Payment Method:</strong> <mark>[PAYMENT_METHOD]</mark></p>
<p><strong>Payment Terms:</strong> <mark>[PAYMENT_TERMS]</mark></p>

<h3>Insurance & Packing</h3>

<ul>
  <li><strong>Insurance:</strong> Under CIF (or CIP), the Seller shall arrange cargo insurance in accordance with CIF (or CIP) of the latest Incoterms of the International Chamber of Commerce.</li>
  <li><strong>Packing:</strong> <mark>[PACKING]</mark></li>
  <li><strong>Marking:</strong> <mark>[MARKING]</mark></li>
</ul>

<h3>Documents Required</h3>

<ul>
  <li>Full set of Clean on Board Bills of Lading</li>
  <li>Signed Commercial Invoices in 3 Originals</li>
  <li>Packing Lists in 3 Originals</li>
  <li>Certificate of Origin in 1 Original plus 1 copy</li>
  <li>Inspection Certificate in 2 Originals</li>
</ul>

<hr>

<h2 style="text-align: center">General Terms and Conditions</h2>

<p>Other detailed terms and conditions of this contract are specified in the following 'General Terms and Conditions'. 'Supplier' and 'Purchaser' agree to the main contracts and "General Terms and Conditions", and to prove the establishment of this contract, two copies of the contract shall be prepared, mutually signed, and each part shall keep one copy of contract.</p>

<h3>Signatures</h3>

<p><strong>Date:</strong> <mark>[CONTRACT_DATE]</mark></p>

<table>
  <tr>
    <th>The Seller (Supplier)</th>
    <th>The Buyer</th>
  </tr>
  <tr>
    <td>
      <p><strong>Company:</strong> <mark>[SUPPLIER_COMPANY]</mark></p>
      <p><strong>Address:</strong> <mark>[SUPPLIER_ADDRESS]</mark></p>
      <p><strong>CEO:</strong> <mark>[SUPPLIER_CEO]</mark></p>
      <p><strong>Signature:</strong> _________________</p>
    </td>
    <td>
      <p><strong>Company:</strong> <mark>[BUYER_COMPANY]</mark></p>
      <p><strong>Address:</strong> <mark>[BUYER_ADDRESS]</mark></p>
      <p><strong>CEO:</strong> <mark>[BUYER_CEO]</mark></p>
      <p><strong>Signature:</strong> _________________</p>
    </td>
  </tr>
</table>
`
