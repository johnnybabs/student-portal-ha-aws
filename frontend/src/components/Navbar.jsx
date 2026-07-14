// Navbar.jsx — sticky navigation bar with auth-aware Teacher Login / Logout controls
import React from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom"; // useNavigate for post-logout redirect
import {
  Box,
  Button,
  Flex,
  HStack,
  Link,
  IconButton,
  Text,
  useColorMode,
} from "@chakra-ui/react"; // Button added for the Logout control
import { MoonIcon, SunIcon } from "@chakra-ui/icons";

export default function Navbar() {
  const { colorMode, toggleColorMode } = useColorMode();
  const location = useLocation(); // Used to detect the active route for link highlighting
  const navigate = useNavigate(); // Used to redirect to /teacher-login after logout

  // Check whether a teacher JWT is stored — re-evaluated on every render so the Navbar
  // reflects the correct state immediately after login or logout without a page refresh
  const isLoggedIn = Boolean(localStorage.getItem('teacherToken'));

  // Clear the stored token and redirect the user to the login page
  const handleLogout = () => {
    localStorage.removeItem('teacherToken'); // Remove the JWT from localStorage
    navigate('/teacher-login');              // Send the user back to the login page
  };

  const NavLink = ({ to, children }) => {
    const isActive = location.pathname === to;
    return (
      <Link
        as={RouterLink}
        to={to}
        px={3}
        py={2}
        rounded="md"
        fontWeight={isActive ? "bold" : "medium"}
        bg={isActive ? "gray.200" : "transparent"}
        _dark={{ bg: isActive ? "gray.700" : "transparent" }}
        _hover={{
          textDecoration: "none",
          bg: "gray.200",
          _dark: { bg: "gray.700" },
        }}
      >
        {children}
      </Link>
    );
  };

  return (
    <Box
      as="header"
      position="sticky"
      top="0"
      zIndex="100"
      bg="white"
      _dark={{ bg: "gray.800" }}
      shadow="sm"
    >
      <Flex
        as="nav"
        h={14}
        align="center"
        px={4}
        maxW="6xl"
        mx="auto"
        justify="space-between"
      >
        <HStack spacing={4}>
          <Text fontWeight="bold">Student–Teacher Portal</Text>
          <NavLink to="/">Home</NavLink>                   {/* Always visible — public page */}
          <NavLink to="/student">Student</NavLink>         {/* Always visible — public page */}
          <NavLink to="/teacher">Teacher</NavLink>         {/* Visible to all; ProtectedRoute handles access */}
          {/* Show Teacher Login link when logged out; show Logout button when logged in */}
          {!isLoggedIn ? (
            <NavLink to="/teacher-login">Teacher Login</NavLink> // Link to login page when no token
          ) : (
            <Button                    // Logout button — only shown when a token exists
              size="sm"
              variant="outline"
              colorScheme="red"
              onClick={handleLogout}   // Clears token and redirects to /teacher-login
            >
              Logout
            </Button>
          )}
        </HStack>
        <IconButton
          aria-label="Toggle color mode"
          icon={colorMode === "light" ? <MoonIcon /> : <SunIcon />}
          onClick={toggleColorMode}
          variant="ghost"
        />
      </Flex>
    </Box>
  );
}
