// TeacherLogin.js — Login and registration page for teacher authentication
import React, { useState } from 'react';
import './TeacherLogin.css'; // Page-scoped styles
import { Helmet } from 'react-helmet-async'; // Page title management
import { useNavigate } from 'react-router-dom'; // Programmatic navigation after login
import {
  Box,
  Button,
  Heading,
  Input,
  FormLabel,
  FormControl,
  VStack,
  useToast,
  Text,
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
} from '@chakra-ui/react'; // Chakra UI components — consistent with rest of the app

function TeacherLogin() {
  // Controlled state for the login form fields
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  // Controlled state for the registration form fields
  const [registerForm, setRegisterForm] = useState({ username: '', password: '' });
  // Loading flag — disables the submit button while a request is in-flight
  const [loading, setLoading] = useState(false);

  const toast = useToast();    // Chakra toast for user feedback — consistent with Teacher.js and Student.js
  const navigate = useNavigate(); // Hook for programmatic navigation to /teacher after login
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL; // Backend base URL baked in at CRA build time

  // Handle controlled input changes for the login form
  const handleLoginChange = (e) => {
    const { name, value } = e.target; // Destructure the changed field name and its new value
    setLoginForm((prev) => ({ ...prev, [name]: value })); // Update only the changed field in state
  };

  // Handle controlled input changes for the register form
  const handleRegisterChange = (e) => {
    const { name, value } = e.target; // Destructure the changed field name and its new value
    setRegisterForm((prev) => ({ ...prev, [name]: value })); // Update only the changed field in state
  };

  // Submit login credentials to the backend and store the returned JWT on success
  const handleLogin = (e) => {
    e.preventDefault(); // Prevent default HTML form submission which would reload the page
    setLoading(true);   // Show loading state on the button while the request is pending
    fetch(`${API_BASE_URL}/teacher/login`, { // POST credentials to the backend login route
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // Tell the backend we are sending JSON
      body: JSON.stringify(loginForm),                  // Serialize the form state as the request body
    })
      .then((res) => res.json()) // Parse the JSON response body regardless of status
      .then((data) => {
        if (data.token) { // A token in the response means authentication succeeded
          localStorage.setItem('teacherToken', data.token); // Persist the JWT under the agreed key name
          toast({ title: 'Login successful', status: 'success', duration: 2000 }); // Notify the user
          navigate('/teacher'); // Redirect to the protected teacher page now that the token is stored
        } else {
          // Backend returned a response but without a token — show the error message from the API
          toast({ title: data.error || 'Login failed', status: 'error', duration: 3000 });
        }
      })
      .catch(() => toast({ title: 'Network error', status: 'error', duration: 3000 })) // Fetch-level failure
      .finally(() => setLoading(false)); // Always clear the loading state after the request completes
  };

  // Submit the registration form to create a new teacher account (admin/dev use)
  const handleRegister = (e) => {
    e.preventDefault(); // Prevent default HTML form submission which would reload the page
    setLoading(true);   // Show loading state on the button while the request is pending
    fetch(`${API_BASE_URL}/teacher/register`, { // POST credentials to the backend register route
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // Tell the backend we are sending JSON
      body: JSON.stringify(registerForm),               // Serialize the form state as the request body
    })
      .then((res) => res.json()) // Parse the JSON response body regardless of status
      .then((data) => {
        if (data.message) { // A message field in the response indicates successful registration
          toast({ title: 'Registered! Please log in.', status: 'success', duration: 2500 }); // Notify user
          setRegisterForm({ username: '', password: '' }); // Clear the form after a successful registration
        } else {
          // Backend returned an error (e.g., duplicate username)
          toast({ title: data.error || 'Registration failed', status: 'error', duration: 3000 });
        }
      })
      .catch(() => toast({ title: 'Network error', status: 'error', duration: 3000 })) // Fetch-level failure
      .finally(() => setLoading(false)); // Always clear the loading state after the request completes
  };

  return (
    <Box maxW="md" mx="auto" mt={10}> {/* Center the card horizontally with a max width */}
      <Helmet>
        <title>Teacher Login • Student–Teacher Portal</title> {/* Set the browser tab title */}
      </Helmet>

      <Heading mb={6} textAlign="center">Teacher Portal</Heading> {/* Page heading */}

      {/* Tabbed layout: Login tab for daily use, Register tab for admin bootstrapping */}
      <Tabs variant="enclosed">
        <TabList>
          <Tab>Login</Tab>    {/* Primary tab — used for normal authentication */}
          <Tab>Register</Tab> {/* Secondary tab — admin/dev use only */}
        </TabList>

        <TabPanels>
          {/* ── LOGIN PANEL ── */}
          <TabPanel>
            <Box as="form" onSubmit={handleLogin}> {/* Semantic form element with Chakra spacing */}
              <VStack spacing={4} align="stretch"> {/* Stack form fields vertically with even gaps */}

                <FormControl isRequired> {/* Username field — required for form validation */}
                  <FormLabel>Username</FormLabel>
                  <Input
                    name="username"             // Matches the loginForm state key
                    value={loginForm.username}  // Controlled value — always reflects state
                    onChange={handleLoginChange} // Update state on every keystroke
                    placeholder="Enter username"
                    autoComplete="username"     // Helps browser autofill and accessibility tools
                  />
                </FormControl>

                <FormControl isRequired> {/* Password field — required for form validation */}
                  <FormLabel>Password</FormLabel>
                  <Input
                    name="password"             // Matches the loginForm state key
                    type="password"             // Mask the input so the password is not visible
                    value={loginForm.password}  // Controlled value — always reflects state
                    onChange={handleLoginChange} // Update state on every keystroke
                    placeholder="Enter password"
                    autoComplete="current-password" // Helps password managers identify this field
                  />
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="teal"         // Consistent with the Save button in Teacher.js
                  isLoading={loading}        // Show spinner while the login request is in-flight
                  loadingText="Logging in…"  // Text displayed alongside the spinner
                >
                  Login
                </Button>

              </VStack>
            </Box>
          </TabPanel>

          {/* ── REGISTER PANEL ── */}
          <TabPanel>
            {/* Warning text so casual users understand this form is not for them */}
            <Text mb={4} fontSize="sm" color="orange.500">
              Admin use only — create teacher accounts here.
            </Text>

            <Box as="form" onSubmit={handleRegister}> {/* Semantic form element with Chakra spacing */}
              <VStack spacing={4} align="stretch"> {/* Stack form fields vertically with even gaps */}

                <FormControl isRequired> {/* Username field — required for form validation */}
                  <FormLabel>Username</FormLabel>
                  <Input
                    name="username"                // Matches the registerForm state key
                    value={registerForm.username}  // Controlled value — always reflects state
                    onChange={handleRegisterChange} // Update state on every keystroke
                    placeholder="Choose a username"
                    autoComplete="off"             // Prevent autofill on the registration form
                  />
                </FormControl>

                <FormControl isRequired> {/* Password field — required for form validation */}
                  <FormLabel>Password</FormLabel>
                  <Input
                    name="password"                // Matches the registerForm state key
                    type="password"                // Mask the input so the password is not visible
                    value={registerForm.password}  // Controlled value — always reflects state
                    onChange={handleRegisterChange} // Update state on every keystroke
                    placeholder="Choose a password"
                    autoComplete="new-password"    // Tells password managers this is a new credential
                  />
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="orange"           // Orange distinguishes this from the login action
                  isLoading={loading}            // Show spinner while the register request is in-flight
                  loadingText="Registering…"     // Text displayed alongside the spinner
                >
                  Register
                </Button>

              </VStack>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}

export default TeacherLogin; // Export for use in Routes.js
