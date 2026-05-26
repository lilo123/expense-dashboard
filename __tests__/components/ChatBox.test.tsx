import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatBox from '@/components/ChatBox';
import { useExpenseStore } from '@/store/useExpenseStore';

// Mock useExpenseStore
jest.mock('@/store/useExpenseStore', () => ({
  useExpenseStore: jest.fn(),
}));

describe('ChatBox Component', () => {
  const mockToggleChatModal = jest.fn();
  const mockAddExpense = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock return value
    (useExpenseStore as unknown as jest.Mock).mockReturnValue({
      isChatModalOpen: true,
      toggleChatModal: mockToggleChatModal,
      addExpense: mockAddExpense,
    });
    // Mock global fetch
    global.fetch = jest.fn();
  });

  it('should not render when isChatModalOpen is false', () => {
    (useExpenseStore as unknown as jest.Mock).mockReturnValue({
      isChatModalOpen: false,
      toggleChatModal: mockToggleChatModal,
      addExpense: mockAddExpense,
    });

    const { container } = render(<ChatBox />);
    expect(container.firstChild).toBeNull();
  });

  it('should render initial AI message and input', () => {
    render(<ChatBox />);

    expect(screen.getByText(/Hi! I can help you add, delete, or summarize expenses/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g., I spent \$15 on coffee/i)).toBeInTheDocument();
  });

  it('should handle message submission and optimistic updates', async () => {
    // Mock fetch success response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        reply: "Got it! $15 for coffee ☕",
        expense: {
          id: 'exp-1',
          amount: 15.0,
          item: 'coffee',
          category_id: 'cat-1',
          date: '2026-05-10',
          categories: { name: 'Food' },
        },
      }),
    });

    render(<ChatBox />);

    const input = screen.getByPlaceholderText(/e.g., I spent \$15 on coffee/i);
    const sendButton = screen.getAllByRole('button')[1];

    // Type message
    fireEvent.change(input, { target: { value: 'spent 15 on coffee' } });
    
    // Click send
    fireEvent.click(sendButton);

    // Optimistic update check: User message should be in the DOM immediately
    expect(screen.getByText('spent 15 on coffee')).toBeInTheDocument();
    expect(screen.getByText('Thinking...')).toBeInTheDocument();

    // Wait for AI response
    await waitFor(() => {
      expect(screen.getByText('Got it! $15 for coffee ☕')).toBeInTheDocument();
    });

    expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
    expect(mockAddExpense).toHaveBeenCalledWith(expect.objectContaining({
      amount: 15.0,
      item: 'coffee',
    }));
  });

  it('should display empathetic fallback error message on network failure', async () => {
    // Mock fetch network error
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<ChatBox />);

    const input = screen.getByPlaceholderText(/e.g., I spent \$15 on coffee/i);
    const sendButton = screen.getAllByRole('button')[1];

    fireEvent.change(input, { target: { value: 'spent 15 on coffee' } });
    fireEvent.click(sendButton);

    // Wait for AI response (error message)
    await waitFor(() => {
      // Checking for empathetic error handling
      expect(screen.getByText(/Uh oh, the system tripped up! Don't worry, your data is safe. Let's try that again./i)).toBeInTheDocument();
    });
  });

  it('should display empathetic fallback error message on server error (500)', async () => {
    // Mock fetch server error (not ok)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({ error: 'Database crash' }),
    });

    render(<ChatBox />);

    const input = screen.getByPlaceholderText(/e.g., I spent \$15 on coffee/i);
    const sendButton = screen.getAllByRole('button')[1];

    fireEvent.change(input, { target: { value: 'spent 15 on coffee' } });
    fireEvent.click(sendButton);

    // Wait for AI response (error message)
    await waitFor(() => {
      // Asserting that real server error string is propagated
      expect(screen.getByText('Database crash')).toBeInTheDocument();
    });
  });

  it('should close modal when clicking close button', () => {
    render(<ChatBox />);

    const closeButton = screen.getByLabelText('Close Modal');
    fireEvent.click(closeButton);

    expect(mockToggleChatModal).toHaveBeenCalledTimes(1);
  });
});
