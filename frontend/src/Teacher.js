// Teacher.js — Teacher CRUD page (protected — requires valid JWT from TeacherLogin)
import React, { useState, useEffect } from 'react';
import './Teacher.css';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom'; // For redirecting to login when the token expires
import {
  Box,
  Button,
  Heading,
  Input,
  FormLabel,
  FormControl,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  VStack,
  HStack,
  useToast,
  Text,
} from '@chakra-ui/react';
import LoadingSpinner from './components/LoadingSpinner';
import EmptyState from './components/EmptyState';

function Teacher() {
  const [teacherData, setTeacherData] = useState({ name: '', subject: '', class: '' });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate(); // Used to redirect to /teacher-login when the JWT is expired or invalid

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL; // Backend base URL baked in at CRA build time

  // Build fetch options with the Authorization header for all authenticated requests
  const authHeaders = () => ({
    'Content-Type': 'application/json',                              // Tell the backend we send JSON
    Authorization: `Bearer ${localStorage.getItem('teacherToken')}`, // Attach the stored JWT
  });

  // If the backend signals the token is missing or expired, clear it and redirect to login
  const handleAuthError = (status) => {
    if (status === 401 || status === 403) {     // 401 = no/bad token, 403 = expired/invalid token
      localStorage.removeItem('teacherToken'); // Clear the stale token from localStorage
      navigate('/teacher-login');              // Send the user back to the login page
    }
  };

  const getData = () => {
    setLoading(true);
    fetch(`${API_BASE_URL}/teacher`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('teacherToken')}` }, // Attach JWT
    })
      .then((res) => {
        if (res.status === 401 || res.status === 403) { // Check for auth failure before parsing body
          handleAuthError(res.status); // Clear token and redirect on auth failure
          return null;                 // Stop the chain — do not attempt to parse the error body
        }
        return res.json(); // Parse JSON body only on a successful response
      })
      .then((res) => {
        if (!res) return;               // Guard: skip state update if handleAuthError already ran
        console.log('Fetched teachers:', res);
        setData(res || []);
      })
      .catch(() => toast({ title: 'Failed to load teachers', status: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getData();
    // eslint-disable-next-line
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTeacherData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault(); // Prevent default HTML form submission which would reload the page
    const requestOptions = {
      method: 'POST',
      headers: authHeaders(), // Include both Content-Type and Authorization headers
      body: JSON.stringify(teacherData), // Serialize the form state as the JSON request body
    };
    fetch(`${API_BASE_URL}/addteacher`, requestOptions)
      .then((res) => {
        if (res.status === 401 || res.status === 403) { // Check for auth failure before parsing body
          handleAuthError(res.status); // Clear token and redirect on auth failure
          return null;                 // Stop the chain
        }
        return res.json(); // Parse JSON body only on a successful response
      })
      .then((data) => {
        if (!data) return; // Guard: skip if handleAuthError already ran
        toast({ title: 'Teacher added', status: 'success' });
        setTeacherData({ name: '', subject: '', class: '' }); // Clear the form after successful add
        getData(); // Refresh the table to show the newly added teacher
      })
      .catch(() => toast({ title: 'Error adding teacher', status: 'error' }));
  };

  const handleDelete = (id) => {
    fetch(`${API_BASE_URL}/teacher/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('teacherToken')}` }, // Attach JWT
    })
      .then((res) => {
        if (res.status === 401 || res.status === 403) { // Check for auth failure before parsing body
          handleAuthError(res.status); // Clear token and redirect on auth failure
          return null;                 // Stop the chain
        }
        return res.json(); // Parse JSON body only on a successful response
      })
      .then((data) => {
        if (!data) return; // Guard: skip if handleAuthError already ran
        toast({ title: 'Deleted', status: 'info' });
        getData(); // Refresh the table after successful deletion
      })
      .catch(() => toast({ title: 'Delete failed', status: 'error' }));
  };

  return (
    <Box>
      <Helmet>
        <title>Teachers • Student–Teacher Portal</title>
      </Helmet>

      <Heading mb={6}>Store Teacher Details</Heading>

      <Box as="form" onSubmit={handleSubmit} mb={8} maxW="lg">
        <VStack spacing={4} align="stretch">
          <FormControl isRequired>
            <FormLabel>Name</FormLabel>
            <Input
              name="name"
              value={teacherData.name}
              onChange={handleChange}
              placeholder="Enter teacher name"
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Subject</FormLabel>
            <Input
              name="subject"
              value={teacherData.subject}
              onChange={handleChange}
              placeholder="Enter subject"
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Class</FormLabel>
            <Input
              name="class"
              value={teacherData.class}
              onChange={handleChange}
              placeholder="Enter class"
            />
          </FormControl>

          <HStack>
            <Button type="submit" colorScheme="teal">
              Save
            </Button>
          </HStack>
        </VStack>
      </Box>

      {loading ? (
        <LoadingSpinner />
      ) : data.length === 0 ? (
        <EmptyState title="No teachers" subtitle="Add your first teacher to see it here." />
      ) : (
        <Box overflowX="auto">
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th>Teacher ID</Th>
                <Th>Name</Th>
                <Th>Subject</Th>
                <Th>Class</Th>
                <Th textAlign="center">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {data.map((d, i) => {
                // ✅ Flexible field handling
                const teacherId =
                  d.teacherId ||
                  d._id ||
                  d.id ||
                  d.TeacherID ||
                  `T-${i + 1}`;
                const name = d.name || d.teacherName || '—';
                const subject = d.subject || d.Subject || d.course || '—';
                const className = d.class || d.Class || d.standard || '—';
                const id = d._id || d.id || teacherId;

                return (
                  <Tr key={id}>
                    <Td fontWeight="bold">{teacherId}</Td>
                    <Td>{name}</Td>
                    <Td>{subject}</Td>
                    <Td>{className}</Td>
                    <Td textAlign="center">
                      <Button
                        size="xs"
                        variant="outline"
                        colorScheme="red"
                        onClick={() => handleDelete(id)}
                      >
                        Delete
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
          <Text mt={3} fontSize="sm" color="gray.500">
            Showing {data.length} teacher{data.length > 1 ? 's' : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default Teacher;
