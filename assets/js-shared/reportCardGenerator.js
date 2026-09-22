import { supabase } from '../../core/config.js';
import { ResultsEngine } from './resultsEngine.js';
import { waitForUser } from '/core/perf.js';

/**
 * Report Card Generator - Professional Academic Reports
 * Generates and manages student report cards with PDF export capability
 */

class ReportCardGenerator {
    constructor() {
        this.resultsEngine = new ResultsEngine();
        this.schoolInfo = null;
    }

    /**
     * Initialize with school information
     */
    async initialize() {
        try {
            // Get school information for branding
            const user = await waitForUser();
            if (!user?.user_metadata?.school_id) {
                throw new Error('School ID not found in user metadata');
            }

            this.schoolInfo = {
                name: user.user_metadata?.school_name || 'Educational Institution',
                logo: user.user_metadata?.school_logo || null,
                address: user.user_metadata?.school_address || null,
                phone: user.user_metadata?.school_phone || null,
                email: user.user_metadata?.school_email || null
            };

            console.log('Report Card Generator initialized for:', this.schoolInfo.name);
            return true;
        } catch (error) {
            console.error('Failed to initialize Report Card Generator:', error);
            return false;
        }
    }

    /**
     * Generate comprehensive report card for a student
     */
    async generateStudentReportCard(studentId, options = {}) {
        try {
            const { data: student, error: studentError } = await supabase
                .from('Students')
                .select(`
                    student_id, 
                    full_name, 
                    admission_date, 
                    class_id, 
                    date_of_birth,
                    gender,
                    parent_email,
                    parent_phone
                `)
                .eq('student_id', studentId)
                .single();

            if (studentError) throw studentError;

            const reportCard = await this.resultsEngine.generateReportCard(studentId, options.term || 'First Term');
            
            return {
                success: true,
                reportCard,
                downloadUrl: () => this.downloadReportCard(reportCard),
                studentInfo: {
                    id: student.student_id,
                    name: student.full_name,
                    class: student.class_id
                }
            };
        } catch (error) {
            console.error('Error generating student report card:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate class performance report
     */
    async generateClassReportCard(classId, options = {}) {
        try {
            const reportCard = await this.resultsEngine.generateReportCard(null, options.term || 'First Term');
            const classData = await this.getClassDetails(classId);
            
            const classReport = {
                ...reportCard,
                title: `${classData.class_name} ${classData.section || ''} - Class Performance Report`,
                type: 'class',
                classInfo: classData
            };

            return {
                success: true,
                reportCard: classReport,
                downloadUrl: () => this.downloadReportCard(classReport),
                classInfo: classData
            };
        } catch (error) {
            console.error('Error generating class report card:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate batch report cards for multiple students
     */
    async generateBatchReportCards(studentIds, options = {}) {
        try {
            const reportCards = await Promise.all(
                studentIds.map(studentId => this.generateStudentReportCard(studentId, options))
            );

            return {
                success: true,
                reportCards,
                downloadAll: () => this.downloadBatchReports(reportCards),
                count: reportCards.length
            };
        } catch (error) {
            console.error('Error generating batch report cards:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get class details
     */
    async getClassDetails(classId) {
        try {
            const { data: classData, error: classError } = await supabase
                .from('Classes')
                .select('class_name, section, teacher_id')
                .eq('class_id', classId)
                .single();

            if (classError) throw classError;

            // Get teacher information
            let teacherInfo = null;
            if (classData.teacher_id) {
                const { data: teacher, error: teacherError } = await supabase
                    .from('Teachers')
                    .select('full_name, email')
                    .eq('teacher_id', classData.teacher_id)
                    .single();

                if (!teacherError) {
                    teacherInfo = {
                        name: teacher.full_name,
                        email: teacher.email
                    };
                }
            }

            return {
                ...classData,
                teacherInfo
            };
        } catch (error) {
            console.error('Error getting class details:', error);
            return null;
        }
    }

    /**
     * Download report card — real PDF export via jsPDF (UMD: window.jspdf.jsPDF).
     * Renders the report card as a formatted PDF; falls back to .txt if jsPDF
     * is unavailable.
     */
    downloadReportCard(reportCard) {
        const student = reportCard.studentInfo || {};
        const perf = reportCard.academicPerformance || {};
        const subjects = Object.entries(perf.subjectAverages || {});

        if (window.jspdf && window.jspdf.jsPDF) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();
            const margin = 48;
            let y = margin;

            // Header
            const schoolName = this.schoolInfo?.name || 'Educational Institution';
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text(schoolName, pageW / 2, y, { align: 'center' });
            y += 20;
            doc.setFontSize(12);
            doc.text('ACADEMIC REPORT CARD', pageW / 2, y, { align: 'center' });
            y += 22;

            // Student info block
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`Name: ${student.name || 'N/A'}`, margin, y); y += 14;
            doc.text(`Class: ${reportCard.classInfo?.class_name || student.class || 'N/A'}`, margin, y); y += 14;
            doc.text(`Admission Date: ${student.admissionDate ? new Date(student.admissionDate).toLocaleDateString() : 'N/A'}`, margin, y); y += 14;
            doc.text(`Term: ${perf.term || 'N/A'}`, margin, y); y += 18;

            // Column positions
            const colX = {
                subject: margin,
                pct: margin + 210,
                grade: margin + 280,
                count: margin + 350,
                remark: margin + 420
            };
            const colHead = ['Subject', 'Average %', 'Grade', 'Assessments', 'Remark'];
            const colPos = Object.values(colX);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            colHead.forEach((h, i) => doc.text(h, colPos[i], y));
            y += 8;
            doc.line(margin, y, pageW - margin, y);
            y += 12;
            doc.setFont('helvetica', 'normal');

            subjects.forEach(([sid, data]) => {
                if (y > 760) { doc.addPage(); y = margin; doc.setFont('helvetica','bold'); doc.setFontSize(9); colHead.forEach((h,i)=>doc.text(h, colPos[i], y)); y += 8; doc.line(margin, y, pageW-margin, y); y += 12; doc.setFont('helvetica','normal'); }
                doc.text(String(sid).slice(0, 18), colX.subject, y);
                doc.text(String(data.averagePercentage ?? '')+'%', colX.pct, y);
                doc.text(data.letterGrade || 'N/A', colX.grade, y);
                doc.text(String(data.assignmentCount ?? 0), colX.count, y);
                doc.text(String(data.remark || ''), colX.remark, y);
                y += 12;
            });
            y += 8;
            doc.line(margin, y, pageW - margin, y);
            y += 14;
            doc.setFont('helvetica', 'bold');
            doc.text(`Overall Grade: ${perf.overallGrade || 'N/A'}`, margin, y); y += 13;
            doc.text(`Grade Remark: ${perf.overallGPA || 'N/A'}`, margin, y);
            doc.setFont('helvetica', 'normal');
            y += 14;
            doc.text(`Generated: ${new Date(reportCard.generatedAt || Date.now()).toLocaleString()}`, margin, y);

            const fname = this.generateFilename(reportCard).replace(/\.txt$/, '.pdf');
            doc.save(fname);
            this.showNotification('Report downloaded as PDF', 'success');
            return;
        }

        // ── Fallback: original text download ──────────────────────
        const content = this.formatReportCard(reportCard);
        const filename = this.generateFilename(reportCard);
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('Report downloaded successfully', 'success');
    }

    /**
     * Download batch reports as ZIP (placeholder)
     */
    downloadBatchReports(reportCards) {
        reportCards.forEach((reportCard, index) => {
            setTimeout(() => {
                this.downloadReportCard(reportCard);
            }, index * 500); // Stagger downloads
        });

        this.showNotification(`${reportCards.length} reports downloaded`, 'success');
    }

    /**
     * Format professional report card
     */
    formatReportCard(reportCard) {
        const isStudent = reportCard.studentInfo;
        const schoolName = this.schoolInfo?.name || 'Educational Institution';

        return `
╔══════════════════════════════════════════════════════════╗
║                    ${schoolName} - ACADEMIC REPORT CARD                    ║
╠══════════════════════════════════════════════════════╣
║                                                              ║
║  STUDENT ACADEMIC RECORD                                       ║
║                                                              ║
╠══════════════════════════════════════════════════════╣
║ Name: ${isStudent ? isStudent.name?.padEnd(35) : 'N/A'.padEnd(35)}                    ║
║ ID: ${isStudent ? isStudent.id?.toString().padEnd(25) : 'N/A'.padEnd(25)}                        ║
║ Class: ${reportCard.classInfo?.class_name || 'N/A'.padEnd(30)}                    ║
║ Admission: ${isStudent ? new Date(reportCard.studentInfo?.admissionDate).toLocaleDateString() : 'N/A'}          ║
║                                                              ║
╠══════════════════════════════════════════════════════╣
║                    ACADEMIC PERFORMANCE                                   ║
║                                                              ║
╠════════════════════════════════════════════════════╣
║ Term: ${reportCard.academicPerformance?.term || 'N/A'}                           ║
║ Overall GPA: ${reportCard.academicPerformance?.overallGPA?.toFixed(2) || 'N/A'}               ║
║ Overall Grade: ${reportCard.academicPerformance?.overallGrade || 'N/A'}                     ║
║ Total Assignments: ${reportCard.academicPerformance?.totalAssignments || 0}                   ║
║                                                              ║
╠══════════════════════════════════════════════════╣
║                    SUBJECT PERFORMANCE BREAKDOWN                           ║
║                                                              ║
${Object.entries(reportCard.academicPerformance?.subjectAverages || {})
    .map(([subject, data]) => {
        const subjectName = subject?.padEnd(25) || 'Unknown'.padEnd(25);
        const percentage = data?.averagePercentage || 0;
        const grade = data?.letterGrade || 'N/A';
        const assignments = data?.assignmentCount || 0;
        
        return `║ ${subjectName}: ${percentage}% (${grade}) - ${assignments} assignments${' '.padEnd(35)}║`;
    }).join('\n')}
╠══════════════════════════════════════════════════╣
║                                                              ║
║                    ADDITIONAL INFORMATION                                   ║
║                                                              ║
╠════════════════════════════════════════════════╣
║ Generated: ${new Date(reportCard.generatedAt).toLocaleString()}                    ║
║ Generated By: ${this.schoolInfo?.name || 'System'}                           ║
║                                                              ║
╚══════════════════════════════════════════════════════╝
        `;
    }

    /**
     * Generate filename for report
     */
    generateFilename(reportCard) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const studentName = reportCard.studentInfo?.name || 'student';
        const cleanName = studentName.replace(/[^a-zA-Z0-9]/g, '-');
        
        if (reportCard.type === 'class') {
            return `${cleanName}-class-report-${timestamp}.txt`;
        }
        
        return `${cleanName}-report-card-${timestamp}.txt`;
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `notification-toast ${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
            opacity: 0;
            transform: translateX(100%);
        `;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Export for global use
window.ReportCardGenerator = ReportCardGenerator;
