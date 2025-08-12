const express = require('express');
const { Op, Sequelize } = require('sequelize');
const { Product, Inventory, Supplier, SupplierProducts, Sales } = require('../models');

const router = express.Router();

router.get('/low-stock-alerts', async (req, res) => {
  try {
    const lowStockProducts = await Product.findAll({
      include: [
        {
          model: Inventory,
          include: ['Warehouse']
        },
        {
          model: SupplierProducts,
          include: [Supplier]
        }
      ],
      where: Sequelize.literal(`
        Product.id IN (
          SELECT i.ProductId
          FROM Inventories i
          WHERE i.quantity < (
            SELECT low_stock_threshold FROM Products p WHERE p.id = i.ProductId
          )
          AND i.ProductId IN (
            SELECT DISTINCT ProductId FROM Sales
            WHERE saleDate >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          )
        )
      `)
    });

    const results = lowStockProducts.map(product => {
      const totalQuantity = product.Inventories.reduce((sum, inv) => sum + inv.quantity, 0);
      const totalRecentSales = product.Sales
        ? product.Sales.reduce((sum, sale) => sum + sale.quantity, 0)
        : 0;
      const dailySalesVelocity = totalRecentSales / 30;
      const daysUntilStockout = dailySalesVelocity > 0
        ? (totalQuantity / dailySalesVelocity).toFixed(1)
        : 'N/A';

      return {
        productId: product.id,
        productName: product.name,
        currentStock: totalQuantity,
        threshold: product.low_stock_threshold,
        suppliers: product.SupplierProducts.map(sp => ({
          supplierId: sp.Supplier.id,
          supplierName: sp.Supplier.name
        })),
        daysUntilStockout
      };
    });

    res.json(results);
  } catch (error) {
    console.error('Error fetching low stock alerts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

