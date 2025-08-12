@app.route('/api/products', methods=['POST'])
def create_product():
    data = request.get_json()

    # Validate required fields
    required_fields = ['name', 'sku', 'price', 'warehouse_id', 'initial_quantity']
    for field in required_fields:
        if field not in data:
            return {"error": f"Missing field: {field}"}, 400

    # Check SKU uniqueness
    if Product.query.filter_by(sku=data['sku']).first():
        return {"error": "SKU already exists"}, 400

    try:
        with db.session.begin():  # Single transaction
            product = Product(
                name=data['name'],
                sku=data['sku'],
                price=Decimal(data['price'])  # More accurate
            )
            db.session.add(product)

            # Add inventory record
            inventory = Inventory(
                product_id=product.id,
                warehouse_id=data['warehouse_id'],
                quantity=max(0, data['initial_quantity'])  # No negative stock
            )
            db.session.add(inventory)

        return {"message": "Product created", "product_id": product.id}, 201

    except Exception as e:
        db.session.rollback()
        return {"error": str(e)}, 500
