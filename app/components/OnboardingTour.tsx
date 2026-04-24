'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

export default function OnboardingTour() {
  const pathname = usePathname();

  useEffect(() => {
    // Định nghĩa tour cho từng trang (Xử lý cả trường hợp có dấu gạch chéo ở cuối)
    const normalizedPath = pathname.replace(/\/$/, '') || '/';
    const isDashboard = normalizedPath === '/';
    const isMinutes = normalizedPath === '/minutes';

    const tourKey = isDashboard ? 'hasSeenDashboardTour' : isMinutes ? 'hasSeenMinutesTour' : null;
    if (!tourKey) return;

    const hasSeenTour = localStorage.getItem(tourKey);
    const params = new URLSearchParams(window.location.search);
    // Chấp nhận cả True, true, TRUE...
    const forceTour = params.get('forceTour')?.toLowerCase() === 'true';

    if (!hasSeenTour || forceTour) {
      let steps: DriveStep[] = [];

      if (isDashboard) {
        steps = [
          {
            element: '#tour-welcome',
            popover: {
              title: 'Chào mừng tới Smart Meeting Assistant',
              description: 'Hãy để tôi hướng dẫn bạn cách sử dụng trợ lý cuộc họp thông minh này trong vài bước đơn giản.',
              side: 'bottom', align: 'start'
            }
          },
          {
            element: '#tour-upload',
            popover: {
              title: 'Tải file ghi âm',
              description: 'Nếu bạn đã có sẵn file MP3 hoặc WAV, hãy kéo thả vào đây để AI tiến hành bóc tách văn bản và tóm tắt.',
              side: 'bottom', align: 'start'
            }
          },
          {
            element: '#tour-record',
            popover: {
              title: 'Ghi âm trực tiếp',
              description: 'Bạn có thể ghi âm trực tiếp cuộc họp ngay tại đây. AI sẽ hiển thị văn bản theo thời gian thực.',
              side: 'bottom', align: 'start'
            }
          },
          {
            element: '#tour-bot',
            popover: {
              title: 'Mời trợ lý ảo (Bot)',
              description: 'Tính năng cao cấp: Mời Bot của chúng tôi vào tham gia cuộc họp trên Zoom/Meet/Teams để tự động ghi chép.',
              side: 'bottom', align: 'start'
            }
          },
          {
            element: '#tour-list',
            popover: {
              title: 'Quản lý cuộc họp',
              description: 'Tất cả các cuộc họp của bạn (bao gồm cả bản nháp) sẽ được lưu trữ và quản lý tập trung tại đây.',
              side: 'top', align: 'start'
            }
          }
        ];
      } else if (isMinutes) {
        steps = [
          {
            element: '#tour-minutes-title',
            popover: {
              title: 'Kho lưu trữ biên bản',
              description: 'Đây là nơi lưu trữ toàn bộ biên bản cuộc họp đã được AI tóm tắt hoặc bạn tự import vào.',
              side: 'bottom', align: 'start'
            }
          },
          {
            element: '#tour-minutes-folder',
            popover: {
              title: 'Phân loại thư mục',
              description: 'Bạn có thể tạo các thư mục để quản lý biên bản theo dự án hoặc phòng ban.',
              side: 'bottom', align: 'start'
            }
          },
          {
            element: '#tour-minutes-import',
            popover: {
              title: 'Import file văn bản',
              description: 'Hỗ trợ tải lên các file .docx, .doc, .txt để AI quản lý và giúp bạn tra cứu nhanh.',
              side: 'bottom', align: 'start'
            }
          },
          {
            element: '#tour-minutes-search',
            popover: {
              title: 'Tìm kiếm thông minh',
              description: 'Tìm kiếm nhanh chóng theo tên cuộc họp hoặc nội dung chi tiết bên trong biên bản.',
              side: 'bottom', align: 'start'
            }
          },
          {
            element: '#tour-minutes-folders',
            popover: {
              title: 'Tra cứu nhanh',
              description: 'Bấm vào từng thư mục để xem các biên bản tương ứng bên trong.',
              side: 'top', align: 'start'
            }
          },
          {
            element: '#tour-minutes-select',
            popover: {
              title: 'Chọn nhiều biên bản',
              description: 'Tích chọn vào các ô bên trái để chọn nhiều biên bản cùng lúc. Khi bạn chọn, một thanh công cụ AI sẽ hiện ra ở phía dưới.',
              side: 'bottom', align: 'start'
            },
            onHighlighted: () => {
              // Tự động tích chọn dòng đầu tiên để hiện thanh AI
              const firstCheckbox = document.querySelector('.tour-checkbox-btn') as HTMLElement;
              if (firstCheckbox) {
                firstCheckbox.click();
              }
            }
          },
          {
            element: '#tour-minutes-ai-panel',
            popover: {
              title: 'Trò chuyện với AI (ChatBot)',
              description: 'Đây là tính năng độc đáo! Bạn có thể hỏi AI bất cứ điều gì dựa trên nội dung của TẤT CẢ các biên bản đã chọn. AI sẽ tổng hợp và trả lời bạn ngay lập tức.',
              side: 'top', align: 'center'
            }
          }
        ];
      }

      if (steps.length === 0) return;

      const driverObj = driver({
        showProgress: true,
        animate: true,
        overlayColor: 'rgba(15, 23, 42, 0.75)',
        allowClose: true,
        popoverClass: 'tour-popover',
        stagePadding: 10,
        stageRadius: 15,
        doneBtnText: 'Hoàn thành',
        nextBtnText: 'Tiếp theo',
        prevBtnText: 'Quay lại',
        steps: steps,
        onDestroyStarted: (element, step, { driver }) => {
          if (!driver.hasNextStep() || confirm("Bạn có chắc chắn muốn bỏ qua hướng dẫn?")) {
            localStorage.setItem(tourKey, 'true');
            driver.destroy();
          }
        },
      });

      // Hàm kiểm tra xem phần tử đầu tiên đã xuất hiện chưa
      const startTourIfReady = (attempts = 0) => {
        const firstElement = steps[0]?.element;
        const exists = typeof firstElement === 'string' ? document.querySelector(firstElement) : null;

        if (exists) {
          driverObj.drive();
        } else if (attempts < 10) {
          // Nếu chưa thấy, thử lại sau 500ms (tổng cộng chờ tối đa 5 giây)
          setTimeout(() => startTourIfReady(attempts + 1), 500);
        }
      };

      const timer = setTimeout(() => {
        startTourIfReady();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return null;
}

