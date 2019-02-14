import { getLibraries, getBooksByPage, borrowCopy, returnBook } from "./BookService";
import { fetchFromAPI } from "./helpers";
import { someBook } from "../../test/booksHelper";

const mockLibraries = {
    count: 2,
    next: null,
    previous: null,
    results: [
        {
            id: 1,
            url: "http://localhost:8000/api/libraries/quito/",
            me: "Quito",
            slug: "quito"
        },
        {
            id: 2,
            url: "http://localhost:8000/api/libraries/bh/",
            name: "Belo Horizonte",
            slug: "bh"
        }
    ]
};

const currentUser = () => ({
    username: "currentuser@example.com",
    email: "currentuser@example.com",
    image_url: ""
});

const someUser = () => ({
    username: "someuser@example.com",
    email: "someuser@example.com",
    image_url: ""
});

const someBookWithNoAvailableCopies = () => someBook([
    {
        id: 1,
        user: someUser()
    }
]);

const someBookWithAvailableCopies = () => someBook([
    {
        id: 1,
        user: null
    }
]);

const someBookWithACopyFromMe = () => someBook([
    {
        id: 1,
        user: currentUser()
    }
]);

jest.mock('./helpers');

describe('Book Service', () => {
    beforeEach(() => {
        jest.resetAllMocks();

        global.currentUser = currentUser();
    });

    it('should return libraries', () => {
        fetchFromAPI.mockResolvedValue(mockLibraries);

        return getLibraries().then(data => {
            expect(fetchFromAPI).toHaveBeenCalledWith('/libraries');
            expect(data.results).toEqual(mockLibraries.results);
        });
    });

    it('should return list of books by page', () => {
        const books = [ someBookWithAvailableCopies() ];
        const slug = "quito";
        const filter = "";
        const page = 1;

        const mockResponse = {
            count: books.length,
            next: null,
            previous: null,
            results: books
        };
        fetchFromAPI.mockResolvedValue(mockResponse);

        return getBooksByPage(slug, page).then(data => {
            expect(fetchFromAPI).toHaveBeenCalledWith(`/libraries/${slug}/books/?page=${page}&book_title=${filter}&book_author=${filter}`);
            expect(data).toEqual(mockResponse);
        });
    });

    it('returns null when response to get books does not have results', () => {
        fetchFromAPI.mockResolvedValue({
            error: 'some error'
        });

        return getBooksByPage('bh', 1).then(data => {
            expect(data).toBeNull();
        });
    });

    describe('Borrow book', () => {
        it('should borrow a book that has an available copy and update the book copies with the user', () => {
            const book = someBookWithAvailableCopies();

            fetchFromAPI.mockResolvedValue({});
            
            return borrowCopy(book).then(() => {
                expect(book.copies[0].user).toEqual(currentUser());
                expect(fetchFromAPI).toHaveBeenCalledWith(`/copies/${book.copies[0].id}/borrow`, 'POST');
            });
        });

        it('shouldnt borrow a book when all copies are borrowed', () => {
            const book = someBookWithNoAvailableCopies();

            return borrowCopy(book).then(() => {
                expect(book.copies[0].user).toEqual(someUser());
                expect(fetchFromAPI).not.toHaveBeenCalled();
            });
        });

        it('shouldnt mark the book as borrowed when the request fails', () => {
            const book = someBookWithAvailableCopies();

            fetchFromAPI.mockRejectedValue(new Error('some error'));

            return borrowCopy(book).catch(() => {
                expect(book.copies[0].user).toBeNull();
            });
        })
    });

    describe('Return book', () => {
        it('should return the book copy and remove the user from the copies', () => {
            const book = someBookWithACopyFromMe();

            fetchFromAPI.mockResolvedValue({});
            
            return returnBook(book).then(() => {
                expect(book.copies[0].user).toBeNull();
                expect(fetchFromAPI).toHaveBeenCalledWith(`/copies/${book.copies[0].id}/return`, 'POST');
            });
        });

        it('shouldnt return a book when doesnt belong to user', () => {
            const book = someBookWithNoAvailableCopies();

            return returnBook(book).then(() => {
                expect(book.copies[0].user).toEqual(someUser());
                expect(fetchFromAPI).not.toHaveBeenCalled();
            });
        });

        it('shouldnt mark the book as returned when the request fails', () => {
            const book = someBookWithACopyFromMe();
            fetchFromAPI.mockRejectedValue(new Error('some error'));

            return returnBook(book).catch(() => {
                expect(book.copies[0].user).toEqual(currentUser());
            });
        })
    });

});