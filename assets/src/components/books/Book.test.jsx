import React from 'react';
import PropTypes from 'prop-types';
import { shallow } from 'enzyme';
import { render, fireEvent, wait } from '@testing-library/react';
import Button from '@material-ui/core/Button';
import Book from './Book';
import {
  someBook,
  someBookWithAvailableCopies,
  someBookWithNoAvailableCopies,
  someBookWithACopyFromMe,
  someBookThatCanBeAddedToWaitlist,
  someBookThatIsInMyWaitlist,
  someAvailableBookThatOthersAreInWaitlist,
} from '../../../test/booksHelper';
import { isWaitlistFeatureActive } from '../../utils/toggles';
import {
  borrowBook,
  returnBook,
  joinWaitlist,
  leaveWaitlist,
  checkWaitlist,
} from '../../services/BookService';
import { NO_WAITLIST_STATUS, FIRST_ON_WAITLIST_STATUS, OTHERS_ARE_WAITING_STATUS } from '../../utils/constants';

jest.mock('../../services/BookService');
jest.mock('../../utils/toggles');

expect.extend({
  toHaveBorrowButton(received) {
    const button = findByTestID(received, 'book-actions').find(Button);
    const pass = button.exists()
      && button.children().text() === 'Borrow'
      && button.length === 1;
    return { pass, message: () => 'expected component to have a borrow button' };
  },

  toHaveReturnButton(received) {
    const button = findByTestID(received, 'book-actions').find(Button);
    const pass = button.exists()
      && button.children().text() === 'Return'
      && button.length === 1;
    return { pass, message: () => 'expected component to have a return button' };
  },

  toHaveJoinWaitlistButton(received) {
    const button = findByTestID(received, 'book-actions').find(Button);
    const pass = button.exists()
      && button.children().text() === 'Join the waitlist'
      && button.length === 1;
    return { pass, message: () => 'expected component to have a join waitlist button' };
  },

  toHaveLeaveWaitlistButton(received) {
    const button = findByTestID(received, 'book-actions').find(Button);
    const pass = button.exists()
      && button.children().text() === 'Leave the waitlist'
      && button.length === 1;
    return { pass, message: () => 'expected component to have a leave waitlist button' };
  },
});

Book.contextTypes = {
  updateUser: PropTypes.func,
};

const defaultContext = { updateUser: jest.fn() };
const createComponent = (book) => shallow(<Book book={book} library="bh" />, { context: defaultContext });
const renderComponent = (book) => render(<Book book={book} library="bh" />);

describe('Book', () => {
  beforeEach(() => {
    global.window.ga = () => { };
    jest.resetAllMocks();
    isWaitlistFeatureActive.mockReturnValue(true);
  });

  it('should contain the book cover as background image', () => {
    const book = someBook();

    const bookComponent = createComponent(book);

    expect(bookComponent.find('.book-cover').props().style.backgroundImage).toEqual(`url('${book.image_url}')`);
  });

  describe('borrowing', () => {
    it('shows the borrow button when the book has a borrow action', () => {
      const book = someBookWithAvailableCopies();
      const { getByText } = renderComponent(book);

      expect(getByText('Borrow')).toBeDefined();
    });

    describe('if waitlist feature is enabled', () => {
      it('if there is no one on the waitlist, user can borrow it with no further confirmation', async () => {
        checkWaitlist.mockResolvedValue({ status: NO_WAITLIST_STATUS });
        borrowBook.mockResolvedValue(someBookWithACopyFromMe());
        const book = someBookWithAvailableCopies();

        const { getByText } = renderComponent(book);

        const button = getByText('Borrow');
        await fireEvent.click(button);

        await wait(() => {
          expect(checkWaitlist).toHaveBeenCalledWith(book);
          expect(borrowBook).toHaveBeenCalledWith(book);
          expect(getByText('Return')).toBeDefined();
        });
      });

      it('if they\'re the first on waitlist, user can borrow it with no further confirmation', async () => {
        checkWaitlist.mockResolvedValue({ status: FIRST_ON_WAITLIST_STATUS });
        borrowBook.mockResolvedValue(someBookWithACopyFromMe());
        const book = someBookWithAvailableCopies();

        const { getByText } = renderComponent(book);

        const button = getByText('Borrow');
        await fireEvent.click(button);

        await wait(() => {
          expect(checkWaitlist).toHaveBeenCalledWith(book);
          expect(borrowBook).toHaveBeenCalledWith(book);
          expect(getByText('Return')).toBeDefined();
        });
      });

      it('if there are users waiting for longer, shows a confirmation dialog to the user', async () => {
        checkWaitlist.mockResolvedValue({ status: OTHERS_ARE_WAITING_STATUS });
        const book = someAvailableBookThatOthersAreInWaitlist();

        const { getByText, getByTestId } = renderComponent(book);

        const button = getByText('Borrow');
        fireEvent.click(button);

        await wait(() => {
          expect(getByTestId('waitlist-users').textContent).toEqual(
            'Users on the wait list: someuser@example.com, someotheruser@example.com',
          );
          expect(getByText(/Do you wish to proceed and borrow this book?/)).toBeDefined();
          expect(checkWaitlist).toHaveBeenCalledWith(book);
          expect(borrowBook).not.toHaveBeenCalled();
        });
      });

      it('if users confirms it, book is borrowed', async () => {
        checkWaitlist.mockResolvedValue({ status: OTHERS_ARE_WAITING_STATUS });
        borrowBook.mockResolvedValue(someBookWithACopyFromMe());
        const book = someBookWithAvailableCopies();

        const { getByText, findByText, queryByText } = renderComponent(book);

        const button = getByText('Borrow');
        fireEvent.click(button);

        const confirmButton = await findByText('Confirm and Borrow');
        fireEvent.click(confirmButton);

        await wait(() => {
          expect(borrowBook).toHaveBeenCalledWith(book);
          expect(getByText('Return')).toBeDefined();
          expect(queryByText(/Do you wish to proceed and borrow this book?/)).toBeNull();
        });
      });

      it('if users cancels it, book is not borrowed and confirmation dialog is closed', async () => {
        checkWaitlist.mockResolvedValue({ status: OTHERS_ARE_WAITING_STATUS });
        borrowBook.mockResolvedValue(someBookWithACopyFromMe());
        const book = someBookWithAvailableCopies();

        const { findByText, queryByText } = renderComponent(book);

        const button = await findByText('Borrow');
        fireEvent.click(button);

        const cancelButton = await findByText('Cancel');
        fireEvent.click(cancelButton);

        await wait(() => {
          expect(borrowBook).not.toHaveBeenCalled();
          expect(findByText('Borrow')).toBeDefined();
          expect(queryByText(/Do you wish to proceed and borrow this book?/)).toBeNull();
        });
      });
    });

    describe('if waitlist feature is disabled', () => {
      beforeEach(() => {
        isWaitlistFeatureActive.mockReturnValue(false);
      });

      it('shows the return button when clicking borrow and API sends return action', async () => {
        borrowBook.mockResolvedValue(someBookWithACopyFromMe());
        const book = someBookWithAvailableCopies();
        const bookComponent = createComponent(book);

        await findByTestID(bookComponent, 'book-actions').find(Button).simulate('click');

        expect(bookComponent).toHaveReturnButton();
      });

      it('calls the borrow function when clicking on the borrow button if the book has no waitlist', async () => {
        borrowBook.mockResolvedValue(someBookWithACopyFromMe());
        const book = someBookWithAvailableCopies();
        const bookComponent = createComponent(book);

        await findByTestID(bookComponent, 'book-actions').find(Button).simulate('click');

        expect(borrowBook).toHaveBeenCalledWith(book);
        expect(defaultContext.updateUser).toHaveBeenCalledTimes(1);
      });

      it('calls the borrow function when clicking on the borrow button', async () => {
        borrowBook.mockResolvedValue(someBookWithACopyFromMe());
        const book = someBookWithAvailableCopies();
        const bookComponent = createComponent(book);

        await findByTestID(bookComponent, 'book-actions').find(Button).simulate('click');

        expect(borrowBook).toHaveBeenCalledWith(book);
        expect(defaultContext.updateUser).toHaveBeenCalledTimes(1);
      });
    });
  });

  it('shows the return button when the book has a return action', () => {
    const book = someBookWithACopyFromMe();
    const bookComponent = createComponent(book);

    expect(bookComponent).toHaveReturnButton();
  });

  it('shows the borrow button when clicking return and API sends borrow action', async () => {
    returnBook.mockResolvedValue(someBookWithAvailableCopies());
    const book = someBookWithACopyFromMe();
    const bookComponent = createComponent(book);

    await findByTestID(bookComponent, 'book-actions').find(Button).simulate('click');

    expect(bookComponent).toHaveBorrowButton();
  });

  it('calls the return function when clicking on the return button', async () => {
    returnBook.mockResolvedValue(someBookWithAvailableCopies());
    const book = someBookWithACopyFromMe();
    const bookComponent = createComponent(book);

    await findByTestID(bookComponent, 'book-actions').find(Button).simulate('click');

    expect(returnBook).toHaveBeenCalledWith(book);
    expect(defaultContext.updateUser).toHaveBeenCalledTimes(1);
  });

  it('has no action button when the book has no action', () => {
    const book = someBook([], [], null);
    const bookComponent = createComponent(book);

    expect(findByTestID(bookComponent, 'book-actions').find(Button).exists()).toBeFalsy();
  });

  describe('if waitlist feature is enabled', () => {
    beforeEach(() => {
      isWaitlistFeatureActive.mockReturnValue(true);
    });

    it('shows the join waitlist button when book can be added to waitlist', async () => {
      const book = someBookThatCanBeAddedToWaitlist();
      const bookComponent = createComponent(book);

      expect(bookComponent).toHaveJoinWaitlistButton();
    });

    it('calls the joinWaitlist method when clicking on the join the waitlist button', async () => {
      joinWaitlist.mockResolvedValue(someBookThatIsInMyWaitlist());
      const book = someBookThatCanBeAddedToWaitlist();
      const bookComponent = createComponent(book);

      await findByTestID(bookComponent, 'book-actions').find(Button).simulate('click');

      expect(joinWaitlist).toHaveBeenCalledWith(book);
      expect(bookComponent).toHaveLeaveWaitlistButton();
    });

    it('shows the leave waitlist button when book is on waitlist', async () => {
      const book = someBookThatIsInMyWaitlist();
      const bookComponent = createComponent(book);

      expect(bookComponent).toHaveLeaveWaitlistButton();
    });

    it('calls the leaveWaitlist method when clicking on the leave waitlist button', async () => {
      leaveWaitlist.mockResolvedValue(someBookThatCanBeAddedToWaitlist());
      const book = someBookThatIsInMyWaitlist();
      const bookComponent = createComponent(book);

      await findByTestID(bookComponent, 'book-actions').find(Button).simulate('click');

      expect(leaveWaitlist).toHaveBeenCalledWith(book);
      expect(bookComponent).toHaveJoinWaitlistButton();
    });

    it('has a waitlist indicator when book is on users waitlist', async () => {
      const book = someBookThatIsInMyWaitlist();
      const { getByTestId, getByText } = renderComponent(book);

      expect(getByTestId('waitlist-indicator')).toBeDefined();
      expect(getByText(/Sep 1, 2019/)).toBeDefined();
    });

    it('doest not have a waitlist indicator when book is not on users waitlist', async () => {
      const booksNotOnWaitlist = [
        someBookWithACopyFromMe(),
        someBookWithAvailableCopies(),
        someBookThatCanBeAddedToWaitlist(),
      ];

      booksNotOnWaitlist.forEach((book) => {
        const { queryByTestId } = renderComponent(book);
        expect(queryByTestId('waitlist-indicator')).toBeNull();
      });
    });
  });

  describe('if waitlist feature is disabled', () => {
    beforeEach(() => {
      isWaitlistFeatureActive.mockReturnValue(false);
    });

    it('does not show the join waitlist button when book can be added to waitlist', async () => {
      const book = someBookThatCanBeAddedToWaitlist();
      const bookComponent = createComponent(book);

      expect(bookComponent).not.toHaveJoinWaitlistButton();
    });
  });

  it('does not show the buttons when the book does not have available copies, ', () => {
    const book = someBookWithNoAvailableCopies();
    const bookComponent = createComponent(book);

    expect(bookComponent).not.toHaveBorrowButton();
    expect(bookComponent).not.toHaveReturnButton();
  });
});
