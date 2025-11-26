import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import transporter from "../config/nodeMailer.js";
import userModel from "../model/userModel.js";

// register a user
export const register = async (req, res) => {
  const { name, email, password } = req.body;

  //   messing details
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "Missing details" });
  }

  try {
    // check if user already exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // create new user
    const user = new userModel({
      name,
      email,
      password: hashedPassword,
    });

    // save user to database
    await user.save();

    // create token and set for cookie
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // sending welcome email
    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: "Welcome to Positive World",
      text: `Welcome to Positive World. Your account has been created by email id: ${email}`,
    };

    await transporter.sendMail(mailOptions);

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// login user
export const login = async (req, res) => {
  const { email, password } = req.body;

  //   messing details
  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Email and password are required" });
  }

  try {
    const user = await userModel.findOne({ email });

    // if user not exists
    if (!user) {
      return res.json({ success: false, message: "Invalid email" });
    }

    const isMatched = await bcrypt.compare(password, user.password);

    // if password not matched
    if (!isMatched) {
      return res.json({ success: false, message: "Invalid password" });
    }
    // create token and set for cookie
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// log out user
export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    });

    return res.json({ success: true, message: "Logged Out" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// send verification OTP to user email
export const sendVerifyOtp = async (req, res) => {
  try {
    // request and receive userId from middleware
    const userId = req.userId;

    const user = await userModel.findById(userId);

    if (user.isAccountVerified) {
      return res
        .status(401)
        .json({ success: false, message: "Account already verified" });
    }

    // make otp and set also expired time
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    user.verifyOtp = otp;
    user.verifyOtpExpiredAt = Date.now() + 24 * 60 * 60 * 1000;

    await user.save();

    // send otp to user
    const mailOption = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Account Verification OPT",
      text: `Your OTP is ${otp}. Verify your account using this OTP`,
    };

    await transporter.sendMail(mailOption);

    return res.json({
      success: true,
      message: "Verification OTP sent on Email",
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: error.message });
  }
};

// verify email using otp
export const verifyEmail = async (req, res) => {
  // request and receive userId from middleware
  const userId = req.userId;
  const { otp } = req.body;

  //   invalid data
  if (!userId || !otp) {
    return res.json({ success: false, message: "Messing details" });
  }

  try {
    const user = await userModel.findById(userId);

    // not valid user
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    // otp not matched
    if (user.verifyOtp === "" || user.verifyOtp !== otp) {
      return res.json({ success: false, message: "Invalid OPT" });
    }

    // already expired otp
    if (user.verifyOtpExpiredAt < Date.now()) {
      return res.json({ success: false, message: "OTP Expired" });
    }

    user.isAccountVerified = true;
    user.verifyOtp = "";
    user.verifyOtpExpiredAt = 0;

    await user.save();
    return res.json({ success: true, message: "Email Verified Successfully" });
  } catch (error) {
    return res.status(401).json({ success: false, message: error.message });
  }
};

// check user is already authenticated or not
export const isAuthenticated = async (req, res) => {
  try {
    return res.json({ success: true });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// password reset otp
export const sendResetOpt = async (req, res) => {
  const { email } = req.body;

  // email not available
  if (!email) {
    return res.json({ success: false, message: "Email is required" });
  }

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    //  make otp and set also expired time
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    user.resetOtp = otp;
    user.resetOtpExpiredAt = Date.now() + 15 * 60 * 1000;

    await user.save();

    // send otp to user
    const mailOption = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Password Reset OPT",
      text: `Your OTP for resetting your password is ${otp}. Use this OTP to proceed with resetting your password`,
    };

    await transporter.sendMail(mailOption);
    return res.json({ success: true, message: "OTP sent to your email" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

// reset user password
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  // if any of the value is invalid
  if (!email || !otp || !newPassword) {
    return res.json({
      success: false,
      message: "Email, OTP, and new password are required",
    });
  }

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if (user.resetOtp === "" || user.resetOtp !== otp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    if (user.resetOtpExpiredAt < Date.now()) {
      return res.json({ success: false, message: "OTP expired" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetOtp = "";
    user.resetOtpExpiredAt = 0;

    await user.save();
    return res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    return res.json({ success: true, message: error.message });
  }
};
