
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ExaminerPosition, PatientInfo, AnswerState, RiskLevel } from './types';
import { M_CHAT_QUESTIONS } from './constants';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    testDate: new Date().toISOString().split('T')[0],
    childName: '',
    homeName: '',
    birthDate: '',
    ageInMonths: 0,
    examinerName: '',
    examinerPosition: ExaminerPosition.TEACHER
  });

  const [answers, setAnswers] = useState<AnswerState>(() => {
    const initial: AnswerState = {};
    M_CHAT_QUESTIONS.forEach(q => initial[q.id] = null);
    return initial;
  });

  const [showResult, setShowResult] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Auto-calculate age in months
  useEffect(() => {
    if (patientInfo.birthDate && patientInfo.testDate) {
      const birth = new Date(patientInfo.birthDate);
      const test = new Date(patientInfo.testDate);
      
      let months = (test.getFullYear() - birth.getFullYear()) * 12;
      months -= birth.getMonth();
      months += test.getMonth();
      
      if (test.getDate() < birth.getDate()) {
        months--;
      }

      setPatientInfo(prev => ({ ...prev, ageInMonths: Math.max(0, months) }));
    }
  }, [patientInfo.birthDate, patientInfo.testDate]);

  const handlePatientInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPatientInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleAnswerChange = (questionId: number, value: boolean) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const failedQuestions = useMemo(() => {
    return M_CHAT_QUESTIONS.filter(q => {
      const answer = answers[q.id];
      if (answer === null) return false;
      if (q.isSpecial) return answer === true; // 2, 5, 12: Yes is a fail
      return answer === false; // Others: No is a fail
    });
  }, [answers]);

  const totalScore = failedQuestions.length;

  const riskResult = useMemo(() => {
    if (totalScore <= 2) return RiskLevel.LOW;
    if (totalScore <= 7) return RiskLevel.MEDIUM;
    return RiskLevel.HIGH;
  }, [totalScore]);

  const generateAiInsights = async () => {
    setIsGeneratingAi(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const failedText = failedQuestions.map(q => `- Câu ${q.id}: ${q.text}`).join('\n');
      
      const prompt = `
        Bạn là một chuyên gia cao cấp về giáo dục đặc biệt và chẩn đoán tự kỷ.
        Dựa trên kết quả sàng lọc M-CHAT-R của trẻ sau đây, hãy viết một bản phân tích chuyên sâu bằng tiếng Việt.
        
        Thông tin trẻ:
        - Tên học sinh: ${patientInfo.childName || 'Chưa rõ'}
        - Tên ở nhà: ${patientInfo.homeName || 'Chưa rõ'}
        - Tuổi: ${patientInfo.ageInMonths} tháng
        - Điểm M-CHAT-R: ${totalScore}/20
        - Mức độ nguy cơ: ${riskResult}
        
        Các câu hỏi trẻ gặp khó khăn (có dấu hiệu nguy cơ):
        ${failedText || 'Không có câu nào.'}
        
        Yêu cầu nội dung (Phải trình bày theo cấu trúc sau, dùng định dạng Markdown):
        1. **Ý nghĩa các chỉ số**: Giải giải thích điểm số ${totalScore} và mức độ ${riskResult} đối với độ tuổi ${patientInfo.ageInMonths} tháng.
        2. **Phân tích hành vi**: Các câu hỏi trẻ gặp khó khăn (như trên) có ý nghĩa lâm sàng gì trong phát triển giao tiếp xã hội?
        3. **Lời khuyên cho Phụ huynh/Giáo viên**: Hành động cụ thể cần làm ngay tại nhà và trường học.
        4. **Các bước can thiệp gợi ý**: Quy trình tiếp theo (Đánh giá chuyên sâu, Can thiệp sớm, xây dựng IEP...).
        
        Hãy viết giọng văn chuyên nghiệp, đồng cảm và mang tính xây dựng. Trình bày rõ ràng.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        generationConfig: {
      maxOutputTokens: 512,
      temperature: 0.7,
    },
      });

      setAiAnalysis(response.text || 'Không thể tạo phân tích vào lúc này.');
    } catch (error) {
      console.error("AI Generation failed:", error);
      setAiAnalysis('Đã có lỗi xảy ra khi kết nối với AI. Vui lòng thử lại sau.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleShowResult = () => {
    setShowResult(true);
    generateAiInsights();
  };

  const resetForm = () => {
    setShowResult(false);
    setAiAnalysis('');
    setAnswers(() => {
        const initial: AnswerState = {};
        M_CHAT_QUESTIONS.forEach(q => initial[q.id] = null);
        return initial;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!reportRef.current) return;
    
    // Tạm thời ẩn các nút để không bị dính vào PDF
    const element = reportRef.current;
    
    const opt = {
      margin: [15, 15, 15, 15],
      filename: `MCHAT_R_${patientInfo.childName || 'KetQua'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        letterRendering: true,
        scrollY: 0 // Quan trọng để tránh lỗi trang trắng khi người dùng đang scroll
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
      // @ts-ignore
      await window.html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("PDF download error:", err);
      alert("Đã xảy ra lỗi khi tạo PDF. Vui lòng thử dùng tính năng 'In kết quả' và chọn 'Lưu thành PDF'.");
    }
  };

  const allAnswered = Object.values(answers).every(a => a !== null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 print:bg-white print:pb-0">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-50 no-print">
        <div className="max-w-4xl mx-auto px-4 py-4 md:py-6 text-center">
          <h1 className="text-xl md:text-2xl font-bold uppercase tracking-tight">
            Bảng kiểm nguy cơ tự kỷ ở trẻ em M-CHAT-R
          </h1>
          <p className="text-sm md:text-base opacity-90 mt-1 italic font-light">
            (Dành cho trẻ từ 16 - 30 tháng tuổi)
          </p>
        </div>
      </header>

      {/* Main Container */}
      <div ref={reportRef} id="printable-area" className="w-full">
        <main className="max-w-4xl mx-auto px-4 mt-8 space-y-8 print:mt-0 print:space-y-6">
          
          {/* Header chỉ xuất hiện trong PDF/Print */}
          <div className="hidden print:block text-center border-b-2 border-blue-600 pb-4 mb-8">
            <h1 className="text-2xl font-bold uppercase text-blue-800">Báo cáo kết quả sàng lọc M-CHAT-R</h1>
            <p className="text-sm text-slate-600 italic">Hệ thống hỗ trợ chẩn đoán giáo dục đặc biệt chuyên sâu</p>
          </div>

          {/* Section A: Thông tin định danh */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 print:border-none print:shadow-none print:p-0">
            <div className="flex items-center gap-2 mb-6 border-b pb-4 print:mb-4">
              <i className="fa-solid fa-id-card text-blue-600 text-xl no-print"></i>
              <h2 className="text-lg font-semibold text-slate-800 uppercase tracking-wide">A. Thông tin định danh</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 print:grid-cols-2 print:gap-x-10 print:gap-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-500">Tên học sinh:</label>
                {!showResult ? (
                  <input
                    type="text"
                    name="childName"
                    placeholder="Nhập họ tên trẻ..."
                    value={patientInfo.childName}
                    onChange={handlePatientInfoChange}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                ) : (
                  <div className="p-3 border rounded-lg bg-slate-50 font-bold print:border-none print:bg-transparent print:p-0 print:text-lg">{patientInfo.childName || "N/A"}</div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-500">Tên gọi ở nhà:</label>
                {!showResult ? (
                  <input
                    type="text"
                    name="homeName"
                    placeholder="Nhập tên ở nhà..."
                    value={patientInfo.homeName}
                    onChange={handlePatientInfoChange}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                ) : (
                  <div className="p-3 border rounded-lg bg-slate-50 font-bold print:border-none print:bg-transparent print:p-0 print:text-lg">{patientInfo.homeName || "N/A"}</div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-500">Ngày tháng năm sinh:</label>
                <div className="flex gap-4 items-center">
                  {!showResult ? (
                    <input
                      type="date"
                      name="birthDate"
                      value={patientInfo.birthDate}
                      onChange={handlePatientInfoChange}
                      className="flex-1 p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  ) : (
                    <div className="flex-1 p-3 border rounded-lg bg-slate-50 font-bold print:border-none print:bg-transparent print:p-0">{patientInfo.birthDate || "N/A"}</div>
                  )}
                  <div className="bg-blue-50 px-4 py-2 rounded-lg flex flex-col justify-center items-center border border-blue-100 print:bg-transparent print:border-slate-200">
                    <span className="text-[10px] uppercase text-blue-600 font-bold">Số tháng</span>
                    <span className="text-xl font-black text-blue-800 leading-none">{patientInfo.ageInMonths}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-500">Ngày thực hiện test:</label>
                {!showResult ? (
                  <input
                    type="date"
                    name="testDate"
                    value={patientInfo.testDate}
                    onChange={handlePatientInfoChange}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                ) : (
                  <div className="p-3 border rounded-lg bg-slate-50 font-bold print:border-none print:bg-transparent print:p-0">{patientInfo.testDate}</div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-500">Người thực hiện:</label>
                {!showResult ? (
                  <input
                    type="text"
                    name="examinerName"
                    placeholder="Nhập tên người thực hiện..."
                    value={patientInfo.examinerName}
                    onChange={handlePatientInfoChange}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                ) : (
                  <div className="p-3 border rounded-lg bg-slate-50 font-bold print:border-none print:bg-transparent print:p-0">{patientInfo.examinerName || "N/A"}</div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-500">Chức vụ:</label>
                {!showResult ? (
                  <select
                    name="examinerPosition"
                    value={patientInfo.examinerPosition}
                    onChange={handlePatientInfoChange}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                  >
                    {Object.values(ExaminerPosition).map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 border rounded-lg bg-slate-50 font-bold print:border-none print:bg-transparent print:p-0">{patientInfo.examinerPosition}</div>
                )}
              </div>
            </div>
          </section>

          {/* Section B: Questions - Chỉ hiện khi đang làm test */}
          {!showResult && (
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden no-print">
              <div className="p-6 border-b bg-slate-50">
                <div className="flex items-center gap-2 mb-2">
                  <i className="fa-solid fa-clipboard-question text-blue-600 text-xl"></i>
                  <h2 className="text-lg font-semibold text-slate-800 uppercase tracking-wide">B. Câu hỏi sàng lọc</h2>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed italic bg-blue-50/50 p-4 rounded-lg border-l-4 border-blue-400">
                  Hãy trả lời các câu hỏi sau về con bạn. Hãy nghĩ về cách cư xử thường xuyên của trẻ. 
                  Nếu bạn đã thấy trẻ có cách cư xử như vậy một vài lần, mà không phải thường xuyên thì hãy trả lời là không. 
                  Khoanh câu trả lời là có hoặc không cho tất cả các câu hỏi. Cảm ơn bạn.
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="hidden md:grid grid-cols-12 bg-slate-50 py-3 px-6 text-sm font-bold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-1">STT</div>
                  <div className="col-span-9">Nội dung câu hỏi & Ví dụ</div>
                  <div className="col-span-2 text-center">Lựa chọn</div>
                </div>
                {M_CHAT_QUESTIONS.map((q) => (
                  <div key={q.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-6 hover:bg-blue-50/30 transition-colors items-center">
                    <div className="col-span-1 flex md:block items-center justify-between">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                        {q.id}
                      </span>
                      <div className="md:hidden flex gap-2">
                        <button
                          onClick={() => handleAnswerChange(q.id, true)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                            answers[q.id] === true
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-500 border-slate-200'
                          }`}
                        >
                          Có
                        </button>
                        <button
                          onClick={() => handleAnswerChange(q.id, false)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                            answers[q.id] === false
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-500 border-slate-200'
                          }`}
                        >
                          Không
                        </button>
                      </div>
                    </div>
                    <div className="col-span-9 space-y-2">
                      <p className="font-medium text-slate-800 leading-relaxed">{q.text}</p>
                      {q.example && (
                        <p className="text-sm text-slate-500 italic bg-slate-100 p-2 rounded border-l-2 border-slate-300">
                          {q.example}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2 hidden md:flex justify-center items-center gap-6">
                      <label className="flex flex-col items-center gap-1 cursor-pointer group">
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={answers[q.id] === true}
                          onChange={() => handleAnswerChange(q.id, true)}
                          className="w-6 h-6 cursor-pointer accent-blue-600"
                        />
                        <span className={`text-xs font-bold ${answers[q.id] === true ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>CÓ</span>
                      </label>
                      <label className="flex flex-col items-center gap-1 cursor-pointer group">
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={answers[q.id] === false}
                          onChange={() => handleAnswerChange(q.id, false)}
                          className="w-6 h-6 cursor-pointer accent-blue-600"
                        />
                        <span className={`text-xs font-bold ${answers[q.id] === false ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>KHÔNG</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section C & D: Results - Hiện khi đã hoàn thành */}
          {showResult && (
            <div className="space-y-10 print:space-y-8">
              {/* C. Kết quả sàng lọc */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden print:shadow-none print:border-slate-300 result-card">
                <div className="bg-slate-900 text-white p-6 flex justify-between items-center print:bg-white print:text-black print:border-b-2 print:border-slate-200">
                    <div>
                      <h2 className="text-xl font-bold uppercase tracking-wide">C. Kết quả sàng lọc</h2>
                      <p className="text-slate-400 text-xs print:text-slate-500">Phân tích chuẩn quốc tế M-CHAT-R</p>
                    </div>
                    <button onClick={resetForm} className="text-slate-300 hover:text-white transition-colors text-sm underline flex items-center gap-1 no-print">
                      <i className="fa-solid fa-rotate-left"></i>
                      Làm lại test
                    </button>
                </div>
                
                <div className="p-8 space-y-8 print:p-6 print:space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center print:flex print:flex-row print:justify-start print:gap-16">
                      <div className="text-center space-y-3">
                        <p className="text-slate-500 uppercase text-xs font-black tracking-widest">Tổng điểm đạt được</p>
                        <div className="relative inline-block">
                          <div className={`w-32 h-32 rounded-full border-[10px] flex items-center justify-center text-5xl font-black print:w-24 print:h-24 print:text-4xl ${
                              riskResult === RiskLevel.LOW ? 'border-green-100 text-green-600' :
                              riskResult === RiskLevel.MEDIUM ? 'border-yellow-100 text-yellow-600' : 'border-red-100 text-red-600'
                          }`}>
                            {totalScore}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 flex-1">
                        <div className={`p-6 rounded-2xl border-l-8 print:p-5 ${
                            riskResult === RiskLevel.LOW ? 'bg-green-50 border-green-500 text-green-800' :
                            riskResult === RiskLevel.MEDIUM ? 'bg-yellow-50 border-yellow-500 text-yellow-800' : 'bg-red-50 border-red-500 text-red-800'
                        }`}>
                            <h3 className="text-xl font-black mb-3 print:text-lg">
                              <span className="uppercase tracking-wider">{riskResult}</span>
                            </h3>
                            <p className="text-sm leading-relaxed font-medium print:text-sm">
                              {riskResult === RiskLevel.LOW && (
                                "Trẻ có nguy cơ thấp. Nếu trẻ nhỏ hơn 24 tháng, hãy làm lại sàng lọc khi trẻ đủ 24 tháng tuổi. Tiếp tục theo dõi các mốc phát triển định kỳ."
                              )}
                              {riskResult === RiskLevel.MEDIUM && (
                                "Trẻ có nguy cơ trung bình. Cần thực hiện thêm Giai đoạn 2 (Phỏng vấn theo dõi). Nếu điểm sau phỏng vấn vẫn ≥ 2, cần đưa trẻ đi khám chuyên khoa ngay."
                              )}
                              {riskResult === RiskLevel.HIGH && (
                                "Trẻ có nguy cơ cao. Cần đưa trẻ đi khám chẩn đoán chuyên sâu tại các cơ sở y tế uy tín và đăng ký can thiệp sớm ngay lập tức."
                              )}
                            </p>
                        </div>
                      </div>
                    </div>
                </div>
              </div>

              {/* D. Phân tích kết quả thông minh */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden print:shadow-none print:border-slate-300 result-card">
                <div className="bg-blue-900 text-white p-6 flex justify-between items-center print:bg-white print:text-black print:border-b-2 print:border-slate-200">
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-wide">D. Phân tích kết quả thông minh (AI INSIGHTS)</h2>
                    <p className="text-blue-300 text-xs print:text-slate-500">Phân tích chuyên sâu bởi trợ lý chuyên gia AI</p>
                  </div>
                  {isGeneratingAi && (
                    <div className="flex items-center gap-2 text-blue-200 text-sm animate-pulse no-print">
                      <i className="fa-solid fa-robot animate-bounce"></i>
                      Đang xử lý dữ liệu...
                    </div>
                  )}
                </div>
                <div className="p-8 prose prose-slate max-w-none print:p-6 print:prose-sm">
                  {isGeneratingAi ? (
                    <div className="space-y-4 no-print">
                      <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse"></div>
                      <div className="h-4 bg-slate-100 rounded w-full animate-pulse"></div>
                      <div className="h-24 bg-slate-50 rounded w-full animate-pulse"></div>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-medium print:text-black print:text-justify print:text-sm">
                      {aiAnalysis || "Hệ thống đang chuẩn bị bản phân tích..."}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer xác nhận cho in ấn */}
              <div className="hidden print:block bg-slate-50 p-6 rounded-xl border border-slate-200 mt-10">
                <div className="grid grid-cols-2 gap-10 text-xs">
                   <div className="space-y-2">
                     <p className="text-slate-500 uppercase font-bold">Thông tin xác thực</p>
                     <p className="text-slate-800"><span className="font-semibold">Người thực hiện:</span> {patientInfo.examinerName}</p>
                     <p className="text-slate-800"><span className="font-semibold">Chức vụ:</span> {patientInfo.examinerPosition}</p>
                     <p className="text-slate-800"><span className="font-semibold">Ngày báo cáo:</span> {new Date().toLocaleDateString('vi-VN')}</p>
                   </div>
                   <div className="text-center flex flex-col items-center justify-end">
                     <div className="w-40 border-b border-slate-400 mb-2"></div>
                     <p className="font-bold text-slate-700">Chữ ký xác nhận</p>
                     <p className="italic text-slate-400 mt-1">(Ký và ghi rõ họ tên)</p>
                   </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer dành cho màn hình làm test */}
      {!showResult && (
        <footer className="mt-12 py-10 border-t border-slate-200 bg-white no-print">
          <div className="max-w-4xl mx-auto px-4 text-center">
              <h5 className="font-bold text-slate-700 mb-3">HƯỚNG DẪN CHẤM ĐIỂM CHI TIẾT</h5>
              <div className="text-sm text-slate-500 space-y-2 inline-block text-left bg-slate-50 p-5 rounded-xl border border-slate-200">
                <p>• Các câu <span className="font-bold text-blue-600">2, 5, 12</span> nếu trả lời <strong>“Có”</strong> thì chấm 1 điểm, <strong>“Không”</strong> thì chấm 0 điểm.</p>
                <p>• Các câu <span className="font-bold text-blue-600">còn lại</span> nếu trả lời <strong>“Có”</strong> thì chấm 0 điểm, <strong>“Không”</strong> thì chấm 1 điểm.</p>
              </div>
              <p className="mt-8 text-[10px] text-slate-400 uppercase tracking-widest font-bold">Hệ thống hỗ trợ chuyên sâu ngành giáo dục đặc biệt</p>
          </div>
        </footer>
      )}

      {/* Các nút hành động cố định ở chân trang cho mobile, hoặc nổi bật trên desktop */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 z-50 no-print flex justify-center shadow-2xl">
        <div className="max-w-4xl w-full flex flex-wrap justify-center gap-4">
          {!showResult ? (
            <div className="flex flex-col items-center w-full gap-2">
               {!allAnswered && (
                 <p className="text-red-500 text-xs font-bold animate-pulse">
                    <i className="fa-solid fa-circle-exclamation mr-1"></i>
                    Vui lòng hoàn thành tất cả 20 câu hỏi
                 </p>
               )}
               <button
                onClick={handleShowResult}
                disabled={!allAnswered}
                className={`px-10 py-4 rounded-2xl font-black text-lg shadow-xl transition-all flex items-center gap-3 ${
                  allAnswered
                    ? 'bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-1 active:scale-95'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                <i className="fa-solid fa-wand-magic-sparkles"></i>
                XEM KẾT QUẢ
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-4 w-full">
              <button
                onClick={handlePrint}
                disabled={isGeneratingAi}
                className="bg-slate-800 text-white px-8 py-4 rounded-xl font-black flex items-center gap-3 hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-50"
              >
                <i className="fa-solid fa-print text-xl"></i>
                IN KẾT QUẢ
              </button>
              <button
                onClick={handleDownload}
                disabled={isGeneratingAi}
                className="bg-blue-600 text-white px-8 py-4 rounded-xl font-black flex items-center gap-3 hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
              >
                <i className="fa-solid fa-file-pdf text-xl"></i>
                TẢI VỀ KẾT QUẢ
              </button>
              <button
                onClick={resetForm}
                className="bg-white text-slate-600 border border-slate-200 px-6 py-4 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all active:scale-95"
              >
                <i className="fa-solid fa-rotate-left"></i>
                LÀM LẠI
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
