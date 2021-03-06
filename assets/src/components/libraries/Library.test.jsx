import React from 'react';
import InfiniteScroll from 'react-infinite-scroller';
import { shallow } from 'enzyme';
import Library from './Library';
import { getBooksByPage } from '../../services/BookService';
import { setRegion } from '../../services/UserPreferences';
import { mockGetBooksByPageResponse, mockGetBooksByPageEmptyResponse } from '../../../test/mockBookService';
import BookList from '../books/BookList';
import SearchBar from './SearchBar';
import ErrorMessage from '../error/ErrorMessage';

jest.mock('../../services/BookService');
jest.mock('../../services/UserPreferences');

const history = { replace: jest.fn(), location: { search: '' } };
const createComponent = (props) => shallow(<Library slug="bh" history={history} {...props} />);

describe('Library', () => {
  let library;

  beforeEach(() => {
    jest.resetAllMocks();
    library = createComponent();
    getBooksByPage.mockResolvedValue(mockGetBooksByPageResponse);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('has the book list inside an infinite scroll', () => {
    expect(library.find(InfiniteScroll).find(BookList).exists()).toBeTruthy();
  });

  it('fetches the first page of books for that library from infinite scroll component', () => {
    const infiniteScroll = library.find(InfiniteScroll);
    infiniteScroll.props().loadMore();

    expect(getBooksByPage).toHaveBeenCalledWith('bh', 1, '');
  });

  it('fetches the second page of books when infinite scroll is called the second time', async () => {
    const infiniteScroll = library.find(InfiniteScroll);
    await infiniteScroll.props().loadMore();
    await infiniteScroll.props().loadMore();

    expect(getBooksByPage).toHaveBeenCalledWith('bh', 2, '');
  });

  it('passes the fetched books to the book list component', async () => {
    const infiniteScroll = library.find(InfiniteScroll);
    await infiniteScroll.props().loadMore();

    expect(library.find(BookList).props().books).toEqual(mockGetBooksByPageResponse.results);
  });

  it('passes the library slug to the book list component', async () => {
    const infiniteScroll = library.find(InfiniteScroll);
    await infiniteScroll.props().loadMore();

    expect(library.find(BookList).props().library).toEqual('bh');
  });

  it('appends the other fetched books to the book list component', async () => {
    const infiniteScroll = library.find(InfiniteScroll);
    await infiniteScroll.props().loadMore();
    await infiniteScroll.props().loadMore();

    expect(library.find(BookList).props().books).toHaveLength(4);
  });

  it('tells the infinite scroller when there are more pages available', async () => {
    getBooksByPage.mockResolvedValue({
      ...mockGetBooksByPageResponse,
      next: 'http://example.com/link/to/next/page',
    });

    const infiniteScroll = library.find(InfiniteScroll);
    await infiniteScroll.props().loadMore();

    expect(library.update().find(InfiniteScroll).props().hasMore).toBeTruthy();
  });

  it('tells the infinite scroller when there arent more pages available', async () => {
    getBooksByPage.mockResolvedValue({
      ...mockGetBooksByPageResponse,
      next: null,
    });

    const infiniteScroll = library.find(InfiniteScroll);
    await infiniteScroll.props().loadMore();

    expect(library.update().find(InfiniteScroll).props().hasMore).toBeFalsy();
  });

  it('has a search bar', () => {
    expect(library.find(SearchBar).exists()).toBeTruthy();
  });

  it('fetches the books with the search term when the search bar is triggered', () => {
    const searchBar = library.find(SearchBar);

    searchBar.props().onChange('test search');

    expect(getBooksByPage).toHaveBeenCalledWith('bh', 1, 'test search');
  });

  it('fetches the books with the search term when location has a query parameter', () => {
    history.location.search = '?q=test+search';
    library = createComponent();
    const infiniteScroll = library.find(InfiniteScroll);
    infiniteScroll.props().loadMore();

    expect(getBooksByPage).toHaveBeenCalledWith('bh', 1, 'test search');
  });

  it('passes the search term to search bar when location has a query parameter', () => {
    history.location.search = '?q=test+search';
    library = createComponent();

    expect(library.find(SearchBar).props().query).toEqual('test search');
  });

  it('sets the search query on the url when searching', async () => {
    getBooksByPage.mockReturnValue(mockGetBooksByPageEmptyResponse);
    const searchBar = library.find(SearchBar);
    const infiniteScroll = library.find(InfiniteScroll);

    searchBar.props().onChange('test search');
    await infiniteScroll.props().loadMore();

    expect(history.replace).toHaveBeenCalledWith({ search: 'q=test+search' });
  });

  it('keeps the previous query params in the url even when search is updated', async () => {
    history.location.search = '?toggle=active';
    getBooksByPage.mockReturnValue(mockGetBooksByPageEmptyResponse);
    const searchBar = library.find(SearchBar);
    const infiniteScroll = library.find(InfiniteScroll);

    searchBar.props().onChange('test search');
    await infiniteScroll.props().loadMore();

    expect(history.replace).toHaveBeenCalledWith({ search: 'toggle=active&q=test+search' });
    history.location.search = '';
  });

  it('removes the search query from the url when search field is empty', async () => {
    getBooksByPage.mockReturnValue(mockGetBooksByPageEmptyResponse);
    const searchBar = library.find(SearchBar);
    const infiniteScroll = library.find(InfiniteScroll);

    searchBar.props().onChange('');
    await infiniteScroll.props().loadMore();

    expect(history.replace).toHaveBeenCalledWith({ search: '' });
  });

  it('clears the previous books when searching', () => {
    library.setState({ books: mockGetBooksByPageResponse.results });
    getBooksByPage.mockResolvedValueOnce(mockGetBooksByPageEmptyResponse);
    const searchBar = library.find(SearchBar);

    searchBar.props().onChange('test search');

    expect(library.state().books).toEqual([]);
  });

  it('does not fetch books again while still loading', () => {
    getBooksByPage.mockResolvedValue({
      ...mockGetBooksByPageResponse,
      next: 'http://example.com/link/to/next/page',
    });

    const infiniteScroll = library.find(InfiniteScroll);
    infiniteScroll.props().loadMore();
    infiniteScroll.props().loadMore();

    expect(getBooksByPage).toHaveBeenCalledTimes(1);
  });

  it('does not update book list when get books fails', async () => {
    library.setState({ books: mockGetBooksByPageResponse.results });
    getBooksByPage.mockRejectedValue(new Error());

    const infiniteScroll = library.find(InfiniteScroll);
    await infiniteScroll.props().loadMore();

    expect(library.state().books).toEqual(mockGetBooksByPageResponse.results);
  });

  it('sets the library in the users preferences when books are loaded', async () => {
    const infiniteScroll = library.find(InfiniteScroll);
    await infiniteScroll.props().loadMore();

    expect(setRegion).toHaveBeenCalledWith('bh');
  });

  it('does not set the library in the users preferences when books fail to load', async () => {
    getBooksByPage.mockRejectedValue(new Error());
    const infiniteScroll = library.find(InfiniteScroll);
    await infiniteScroll.props().loadMore();

    expect(setRegion).not.toHaveBeenCalled();
  });

  it('shows an error message when loading books fails', async () => {
    getBooksByPage.mockRejectedValue(new Error());
    const infiniteScroll = library.find(InfiniteScroll);
    await infiniteScroll.props().loadMore();

    expect(library.find(InfiniteScroll).find(BookList).exists()).toBeFalsy();
    expect(library.find(ErrorMessage).exists()).toBeTruthy();
  });

  it('fetches the books again when the library slug passed via props changes', () => {
    library.setProps({ slug: 'quito' });
    expect(getBooksByPage).toHaveBeenCalledWith('quito', 1, '');
  });

  it('does not fetch the books again when the library slug passed via props does not change', () => {
    library.setProps({ slug: 'bh' });
    expect(getBooksByPage).not.toHaveBeenCalledWith('bh', 1, '');
  });
});
