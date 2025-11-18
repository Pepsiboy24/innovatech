document.addEventListener('DOMContentLoaded', function () {
            const tableBody = document.getElementById('academicTableBody');
            const monthYearSpan = document.getElementById('monthYear');

            // 1. ACADEMIC EVENTS DATA: Based on the Enugu State Academic Calendar for 2024/2025 Session
            const academicEvents = [
                {
                    term: '1st Term',
                    activity: 'First Term Commences',
                    start: '2025-09-22',
                    end: '2025-09-22',
                    duration: '1 Day',
                    remarks: 'All Schools Resume.'
                },
                {
                    term: 'Holiday',
                    activity: 'Public Holiday (Independence Day)',
                    start: '2025-10-01',
                    end: '2025-10-01',
                    duration: '1 Day',
                    remarks: 'School Closed.'
                },
                {
                    term: '1st Term',
                    activity: 'Mid-Term Break',
                    start: '2025-11-03',
                    end: '2025-11-07',
                    duration: '5 Days',
                    remarks: 'No academic activities.'
                },
                {
                    term: '1st Term',
                    activity: 'Mock Examinations for Senior Secondary',
                    start: '2025-11-10',
                    end: '2025-11-14',
                    duration: '5 Days',
                    remarks: 'Internal examinations.'
                },
                {
                    term: '1st Term',
                    activity: '1st Term Ends',
                    start: '2025-12-19',
                    end: '2025-12-19',
                    duration: '1 Day',
                    remarks: 'Christmas break begins.'
                },
                {
                    term: '2nd Term',
                    activity: 'Second Term Commences',
                    start: '2026-01-12',
                    end: '2026-01-12',
                    duration: '1 Day',
                    remarks: 'All Schools Resume.'
                },
                {
                    term: 'Holiday',
                    activity: 'Public Holiday (Republic Day)',
                    start: '2026-03-02',
                    end: '2026-03-02',
                    duration: '1 Day',
                    remarks: 'School Closed.'
                },
                {
                    term: '2nd Term',
                    activity: 'Mid-Term Break',
                    start: '2026-02-23',
                    end: '2026-02-27',
                    duration: '5 Days',
                    remarks: 'No academic activities.'
                },
                {
                    term: '2nd Term',
                    activity: 'Second Term Ends',
                    start: '2026-04-09',
                    end: '2026-04-09',
                    duration: '1 Day',
                    remarks: 'Easter break begins.'
                },
                {
                    term: '3rd Term',
                    activity: 'Third Term Commences',
                    start: '2026-04-27',
                    end: '2026-04-27',
                    duration: '1 Day',
                    remarks: 'All Schools Resume.'
                },
                {
                    term: 'Holiday',
                    activity: 'Public Holiday (Workers Day)',
                    start: '2026-05-01',
                    end: '2026-05-01',
                    duration: '1 Day',
                    remarks: 'School Closed.'
                },
                {
                    term: '3rd Term',
                    activity: 'Mid-Term Break',
                    start: '2026-06-08',
                    end: '2026-06-12',
                    duration: '5 Days',
                    remarks: 'No academic activities.'
                },
                {
                    term: '3rd Term',
                    activity: 'Third Term Ends',
                    start: '2026-07-24',
                    end: '2026-07-24',
                    duration: '1 Day',
                    remarks: 'End of academic session.'
                }
            ];

            // Function to format date range
            function formatDateRange(start, end) {
                const startDate = new Date(start);
                const endDate = new Date(end);
                const options = { month: 'short', day: 'numeric', year: 'numeric' };

                if (start === end) {
                    return startDate.toLocaleDateString('en-US', options);
                } else {
                    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
                }
            }

            // Function to populate the table
            function populateTable(events) {
                tableBody.innerHTML = '';
                events.forEach(event => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${event.term}</td>
                        <td>${event.activity}</td>
                        <td>${formatDateRange(event.start, event.end)}</td>
                        <td>${event.duration}</td>
                        <td>${event.remarks}</td>
                    `;
                    tableBody.appendChild(row);
                });
            }

            // Initial population
            populateTable(academicEvents);

            // Set initial month/year display
            monthYearSpan.textContent = '2024/2025 Academic Session';

            // Navigation buttons functionality (simplified for table view)
            document.getElementById('prevButton').addEventListener('click', function() {
                // For now, just scroll to top or implement filtering if needed
                tableBody.scrollIntoView({ behavior: 'smooth' });
            });
            document.getElementById('nextButton').addEventListener('click', function() {
                // For now, just scroll to bottom or implement filtering if needed
                tableBody.scrollIntoView({ behavior: 'smooth', block: 'end' });
            });
            document.getElementById('todayButton').addEventListener('click', function() {
                // Reset to full view
                populateTable(academicEvents);
            });

            // --- Modal functionality ---
            const addEventBtn = document.querySelector('.add-event-btn');
            const modal = document.getElementById('addEventModal');
            const closeModal = document.getElementById('closeModal');
            const cancelBtn = document.getElementById('cancelBtn');
            const addEventForm = document.getElementById('addEventForm');

            // Open modal
            addEventBtn.addEventListener('click', () => {
                modal.classList.add('show');
            });

            // Close modal functions
            const closeModalFunc = () => {
                modal.classList.remove('show');
                addEventForm.reset();
            };

            closeModal.addEventListener('click', closeModalFunc);
            cancelBtn.addEventListener('click', closeModalFunc);

            // Close modal when clicking outside
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModalFunc();
                }
            });

            // Handle form submission
            addEventForm.addEventListener('submit', (e) => {
                e.preventDefault();

                const formData = new FormData(addEventForm);
                const newEvent = {
                    id: Date.now(), // Simple ID generation for demo
                    academic_session: formData.get('academicSession'),
                    term_period: formData.get('termPeriod'),
                    activity_event: formData.get('activityEvent'),
                    start_date: formData.get('startDate'),
                    end_date: formData.get('endDate'),
                    duration: formData.get('duration'),
                    remarks: formData.get('remarks')
                };

                // Add to academicEvents array (in a real app, this would be sent to server)
                const eventForTable = {
                    term: newEvent.term_period,
                    activity: newEvent.activity_event,
                    start: newEvent.start_date,
                    end: newEvent.end_date,
                    duration: newEvent.duration,
                    remarks: newEvent.remarks
                };

                academicEvents.push(eventForTable);

                // Re-populate table
                populateTable(academicEvents);

                // Close modal
                closeModalFunc();

                // For demo purposes, log the data that would be sent to database
                console.log('New event data:', newEvent);
                alert('Event added successfully! Check console for data that would be sent to database.');
            });

            // --- Mobile menu toggle functionality ---
            const menuToggle = document.getElementById('menuToggle');
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.getElementById('overlay');

            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                overlay.classList.toggle('show');
            });

            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('show');
            });
        });