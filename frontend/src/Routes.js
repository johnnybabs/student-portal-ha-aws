// Routes.js – React Router v6 route table including protected teacher route
import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./Home";                               // Public home page
import Student from "./Student";                         // Public student CRUD page (frozen)
import Teacher from "./Teacher";                         // Teacher CRUD page — requires auth
import TeacherLogin from "./TeacherLogin";               // Login/register page for teachers
import ProtectedRoute from "./components/ProtectedRoute"; // Auth guard — redirects if no token

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />                          {/* Public home page */}
      <Route path="/student" element={<Student />} />                {/* Public student page — frozen */}
      <Route path="/teacher-login" element={<TeacherLogin />} />    {/* Public teacher login page */}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute> {/* Wrap Teacher with auth guard — redirects to /teacher-login if no token */}
            <Teacher />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
