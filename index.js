const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const port = process.env.PORT || 4000;
const midtransClient = require("midtrans-client");

app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:4000",
      "api.timorkings.com",
    ],
    methods: "GET, POST, PUT, DELETE",
    allowedHeaders: "Content-Type, Authorization, auth-token",
  })
);

let snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: "Mid-server-fTEmzGqaLzOW7kinbyVAyMOt",
});

// Database Connection With MongoDB
mongoose.connect(
  "mongodb+srv://lestilesbali:qTsaWXCTKA8N2RfQ@cluster0.5bupp.mongodb.net/e-commerce"
);

// paste your mongoDB Connection string above with password
// password should not contain '@' special character

//Image Storage Engine
const storage = multer.diskStorage({
  destination: "./upload/images",
  filename: (req, file, cb) => {
    return cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});
const upload = multer({ storage: storage });
app.post("/upload", upload.single("product"), (req, res) => {
  res.json({
    success: 1,
    image_url: `/images/${req.file.filename}`,
  });
});

// Route for Images folder
app.use("/images", express.static("upload/images"));

// MiddleWare to fetch user from token
const fetchuser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    res.status(401).send({ errors: "Please authenticate using a valid token" });
  }
  try {
    const data = jwt.verify(token, "secret_ecom");
    req.user = data.user;
    next();
  } catch (error) {
    res.status(401).send({ errors: "Please authenticate using a valid token" });
  }
};

// Schema for creating user model
const Users = mongoose.model("Users", {
  name: { type: String },
  email: { type: String, unique: true },
  password: { type: String },
  cartData: { type: Object },
  date: { type: Date, default: Date.now() },
});

// Schema for creating Product
const Product = mongoose.model("Product", {
  id: { type: Number, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  category: { type: String, required: true },
  new_price: { type: Number },
  old_price: { type: Number },
  date: { type: Date, default: Date.now },
  avilable: { type: Boolean, default: true },
});

const Order = mongoose.model("Order", {
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  items: [
    {
      productId: { type: Number, required: true },
      quantity: { type: Number, required: true },
    },
  ],
  totalAmount: { type: Number, required: true },
  paymentStatus: {
    type: String,
    enum: ["pending", "success", "failed"],
    default: "pending",
  },
  transactionId: { type: String },
  paymentType: { type: String },
  paymentResponse: { type: Object },
  date: { type: Date, default: Date.now },
});

// ROOT API Route For Testing
app.get("/", (req, res) => {
  res.send("Root");
});

// Create an endpoint at ip/login for login the user and giving auth-token
app.post("/login", async (req, res) => {
  console.log("Login");
  let success = false;
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    const passCompare = req.body.password === user.password;
    if (passCompare) {
      const data = {
        user: {
          id: user.id,
        },
      };
      success = true;
      console.log(user.id);
      const token = jwt.sign(data, "secret_ecom");
      res.json({ success, token });
    } else {
      return res.status(400).json({
        success: success,
        errors: "please try with correct email/password",
      });
    }
  } else {
    return res.status(400).json({
      success: success,
      errors: "please try with correct email/password",
    });
  }
});

//Create an endpoint at ip/auth for regestring the user & sending auth-token
app.post("/signup", async (req, res) => {
  console.log("Sign Up");
  let success = false;
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({
      success: success,
      errors: "existing user found with this email",
    });
  }
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }
  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });
  await user.save();
  const data = {
    user: {
      id: user.id,
    },
  };

  const token = jwt.sign(data, "secret_ecom");
  success = true;
  res.json({ success, token });
});

// endpoint for getting all products data
app.get("/allproducts", async (req, res) => {
  let products = await Product.find({});
  console.log("All Products");
  res.send(products);
});

// endpoint for getting latest products data
app.get("/newcollections", async (req, res) => {
  let products = await Product.find({});
  let arr = products.slice(0).slice(-8);
  console.log("New Collections");
  res.send(arr);
});

// endpoint for getting womens products data
app.get("/popularinwomen", async (req, res) => {
  let products = await Product.find({ category: "women" });
  let arr = products.splice(0, 4);
  console.log("Popular In Women");
  res.send(arr);
});

// endpoint for getting womens products data
app.post("/relatedproducts", async (req, res) => {
  console.log("Related Products");
  const { category } = req.body;
  const products = await Product.find({ category });
  const arr = products.slice(0, 4);
  res.send(arr);
});

// Create an endpoint for saving the product in cart
app.post("/addtocart", fetchuser, async (req, res) => {
  console.log("Add Cart");
  let userData = await Users.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Added");
});

// Create an endpoint for removing the product in cart
app.post("/removefromcart", fetchuser, async (req, res) => {
  console.log("Remove Cart");
  let userData = await Users.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] != 0) {
    userData.cartData[req.body.itemId] -= 1;
  }
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Removed");
});

// Create an endpoint for getting cartdata of user
app.post("/getcart", fetchuser, async (req, res) => {
  console.log("Get Cart");
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});

// Create an endpoint for adding products using admin panel
app.post("/addproduct", async (req, res) => {
  let products = await Product.find({});
  let id;
  if (products.length > 0) {
    let last_product_array = products.slice(-1);
    let last_product = last_product_array[0];
    id = last_product.id + 1;
  } else {
    id = 1;
  }
  const product = new Product({
    id: id,
    name: req.body.name,
    description: req.body.description,
    image: req.body.image,
    category: req.body.category,
    new_price: req.body.new_price,
    old_price: req.body.old_price,
  });
  await product.save();
  console.log("Saved");
  res.json({ success: true, name: req.body.name });
});

// Create an endpoint for removing products using admin panel
app.post("/removeproduct", async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  console.log("Removed");
  res.json({ success: true, name: req.body.name });
});

// Endpoint untuk mengambil riwayat order user yang login
app.get("/order-history", fetchuser, async (req, res) => {
  console.log("Get Order History");

  try {
    const orders = await Order.find({ userId: req.user.id }).sort({ date: -1 });

    res.json(orders);
  } catch (error) {
    console.error("Error getting order history:", error);
    res.status(500).json({ error: "Server error while getting order history" });
  }
});

// Get all orders for admin
app.get("/all-orders", async (req, res) => {
  try {
    const orders = await Order.find({}).populate("userId", "name email").exec();
    res.json(orders);
  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint untuk membuat transaksi pembayaran
app.post("/create-transaction", fetchuser, async (req, res) => {
  try {
    const user = await Users.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const cartData = user.cartData || {};
    const items = [];
    let totalAmount = 0;

    for (const [productId, quantity] of Object.entries(cartData)) {
      if (quantity > 0) {
        const product = await Product.findOne({ id: parseInt(productId) });
        if (product) {
          items.push({
            productId: product.id,
            quantity: quantity,
          });
          totalAmount += product.new_price * quantity;
        }
      }
    }

    if (items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const order = new Order({
      userId: user._id,
      items: items,
      totalAmount: totalAmount,
      paymentStatus: "pending",
    });
    await order.save();

    const parameter = {
      transaction_details: {
        order_id: `ORDER-${order._id}-${Date.now()}`,
        gross_amount: totalAmount,
      },
      credit_card: {
        secure: true,
      },
      customer_details: {
        email: user.email,
        first_name: user.name,
      },
    };

    const transaction = await snap.createTransaction(parameter);

    order.transactionId = parameter.transaction_details.order_id;
    await order.save();

    res.json({ snapToken: transaction.token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Callback dari Midtrans
app.post("/midtrans-callback", async (req, res) => {
  try {
    const callbackData = req.body;

    const transactionStatus = callbackData.transaction_status;
    const orderId = callbackData.order_id;

    console.log("Callback Midtrans diterima", callbackData);

    const order = await Order.findOne({ transactionId: orderId });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (transactionStatus === "capture" || transactionStatus === "settlement") {
      order.paymentStatus = "success";
      order.paymentType = callbackData.payment_type;
      order.paymentResponse = callbackData;
      await order.save();

      const user = await Users.findById(order.userId);
      if (user && user.cartData) {
        const newCartData = {};
        for (let key in user.cartData) {
          newCartData[key] = 0;
        }
        await Users.findByIdAndUpdate(order.userId, { cartData: newCartData });
      }

      console.log(`Order ${orderId} berhasil dibayar`);
    } else if (
      transactionStatus === "cancel" ||
      transactionStatus === "expire" ||
      transactionStatus === "deny"
    ) {
      order.paymentStatus = "failed";
      order.paymentResponse = callbackData;
      await order.save();
      console.log(`Order ${orderId} gagal bayar`);
    }

    res.status(200).json({ message: "Callback processed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Callback error" });
  }
});

// Starting Express Server
app.listen(port, (error) => {
  if (!error) console.log("Server Running on port " + port);
  else console.log("Error : ", error);
});
