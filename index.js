require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const bcrypt = require('bcrypt');
const cors = require('cors');


const app = express();
app.use(bodyParser.json());

app.use(cors());

app.options("*", function (req, res, next) {
  console.log("inside this");
  res.header("Access-Control-Allow-Origin", req.get("Origin") || "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

// Multer storage configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });
 
// Connect to MongoDB
const username=process.env.MONGO_USERNAME;
const password=process.env.PASSWORD;

console.log("vrevr",username);
console.log("elrvwev",password);

const url=`mongodb+srv://${username}:${password}@flipkart.ejltgee.mongodb.net/LoginDB`
mongoose.connect(url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Define User schema
const UserSchema = new mongoose.Schema({
  firstName:{ type: String, required: true, unique: false },
  lastName:{ type: String, required: true, unique: false },
  email:{ type: String, required: true, unique: true},
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userType:{type:String,required:true}
});

// Define Assignment schema
const AssignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  image_file: { data: Buffer, contentType: String } // Field for storing the file as blob
});

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});



const User = mongoose.model('User', UserSchema);

const Assignment = mongoose.model('Assignment', AssignmentSchema);

const Message = mongoose.model('Message', messageSchema);

// Signup endpoint
app.post('/signup', async (req, res) => {
  console.log('getting sign up',req);
  const { username, password,userType,firstName,lastName,email } = req.body;
  console.log('role',userType);
  try {
    // Check if the username is already taken
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create a new user
    const newUser = new User({ username, password: hashedPassword,userType,firstName,lastName,email });
    await newUser.save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error signing up:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  console.log('getting login up',req);
  const { username, password } = req.body;
  try {
    // Find the user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.status(200).json({ userData: user });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Route to upload assignment
app.post('/upload-assignment', upload.single('file'), async (req, res) => {
  const { title, description, username, password } = req.body;
  console.log("uplaod assignemnt",req.body);
  
  try {
    // Find the user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // // Verify user's password
    // const passwordValid = await bcrypt.compare(password, user.password);
    // if (!passwordValid) {
    //   return res.status(401).json({ message: 'Invalid password' });
    // }

    // Create a new assignment
    const assignment = new Assignment({
      title,
      description,
      uploadedBy: user._id,
      image_file: {
        data: req.file.buffer, // Assign the file buffer to the data field
        contentType: req.file.mimetype // Assign the MIME type of the file
      }
    });

    await assignment.save();
    res.status(201).json({ message: 'Assignment uploaded successfully' });
  } catch (error) {
    console.error('Error uploading assignment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Route to get assignments based on user type and, if applicable, user ID
app.post('/assignments', async (req, res) => {
  console.log('loggin request body',req.body);
  const { studentId } = req.body;

  try {
      // Fetch assignments for a specific student
    const assignments = await Assignment.find({ uploadedBy: studentId });
    const student=await User.find({_id:studentId});
    const studentName=student[0].firstName;
    console.log('student name',studentName);
    res.status(200).json({ assignments,studentName });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/get-students', async (_req, res) => {
  try {
    // Fetch students for a teachers
    const students = await User.find({ userType: "student" });
    console.log('return data',students);
    res.status(200).json({ students });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Route for sending a message
app.post('/sendmessage', async (req, res) => {
  const {recieverId,senderId,newMessage } = req.body;

  try {
    const newMessageCome = new Message({ sender:senderId, receiver:recieverId, message: newMessage });
    await newMessageCome.save();
    res.status(201).json({ message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Route for fetching messages between two users
app.post('/getmessages/', async (req, res) => {
  console.log('getting body to get messages',req.body);
  const { sender_id, reciever_id } = req.body;

  try {
    const messages = await Message.find({ 
      $or: [
        { sender: sender_id, receiver: reciever_id },
        { sender: reciever_id, receiver: sender_id }
      ]
    }).sort('timestamp');
    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Route for fetching messages between two users
app.get('/getallUsers/', async (_req, res) => {

  try {
    const users = await User.find({});
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users :', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start the server
const PORT = 8085;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
