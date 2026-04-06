function validateBuyerCustomerParty(buyerCustomerParty) {
    if (!buyerCustomerParty['cac:Party']) {
        return { success: false, errors: ['Invalid Order XML: Missing cac:Party element in cac:BuyerCustomerParty'] };
    }
    const party = buyerCustomerParty['cac:Party'];
    if (!party['cac:PartyName'] || !party['cac:PartyName']['cbc:Name']) {
        return { success: false, errors: ['Invalid Order XML: Missing cac:PartyName/cbc:Name element in cac:BuyerCustomerParty'] };
    }
    return { success: true };
}

function validateSellerSupplierParty(sellerSupplierParty) {
    if (!sellerSupplierParty['cac:Party']) {
        return { success: false, errors: ['Invalid Order XML: Missing cac:Party element in cac:SellerSupplierParty'] };
    }
    const party = sellerSupplierParty['cac:Party'];
    if (!party['cac:PartyName'] || !party['cac:PartyName']['cbc:Name']) {
        return { success: false, errors: ['Invalid Order XML: Missing cac:PartyName/cbc:Name element in cac:SellerSupplierParty'] };
    }
    return { success: true };
}

module.exports = {
    validateBuyerCustomerParty,
    validateSellerSupplierParty
};