'use strict';

angular
  .module('libraryUiApp')
  .controller('BookCtrl', ['$scope',
    'BookService',
    'LoanService',
    'NavigationService',
    'Modal',
    '$translate',
    '$route',
    '$routeParams',
    'UserService',
    'toastr',
    function ($scope, BookService, LoanService, NavigationService, Modal, $translate, $route, $routeParams, UserService, toastr) {
      var isInBookDetails = NavigationService.isBookDetails();

      $scope.currentUserEmail = window.sessionStorage.email;

      $scope.borrowerIsCurrentUser = function (copy) {

        if (copy.lastLoan !== undefined && copy.lastLoan !== null) {
          return copy.lastLoan.email.toLowerCase() === $scope.currentUserEmail.toLowerCase();
        }else {
          return false;
        }

      };

      $scope.goBack = function () {
        NavigationService.goBack();
      };

      $scope.isSettingsActive = function () {
        return NavigationService.isSettingsActive();
      };

      $scope.isAddBookActive = function () {
        return NavigationService.isAddBookActive();
      };

      $scope.isAddWishActive = function () {
        return NavigationService.isAddWishActive();
      };

      $scope.isAllBooksActive = function () {
        return NavigationService.isAllBooksActive();
      };

      $scope.isWishlistActive = function () {
        return NavigationService.isWishlistActive();
      };

      $scope.isBorrowedBooksActive = function () {
        return NavigationService.isBorrowedBooksActive();
      };

      $scope.getCurrentLibraryPath = function () {
        return $scope.isInsideLibrary() ? '#/library/' + getLibrarySlug() : '#/libraries';
      };


      $scope.isInsideLibrary = function () {
        return angular.isDefined($route.current) ? angular.isDefined(getLibrarySlug()) : false;
      };

      $scope.listBooks = function () {

        $scope.copies = [];

        BookService.getLibraryBySlug(getLibrarySlug()).
          success(function (data) {
            if (angular.isDefined(data._embedded) && data._embedded.libraries[0]._embedded) {
              $scope.copies = data._embedded.libraries[0]._embedded.copies;

              angular.forEach($scope.copies, function (copy) {
                copy = initializeCopy(copy);
              });
            }
          });
      };

      function initializeCopy(copy) {
        if (copy.imageUrl === undefined || copy.imageUrl === null) {
          copy.imageUrl = 'images/no-image.png';
        }

        if (copy.lastLoan !== undefined && copy.lastLoan !== null) {
          copy.lastLoan.user = {};
          copy.lastLoan.user.imageUrl = UserService.getGravatarFromUserEmail(copy.lastLoan.email);
        }

        return copy;
      }

      $scope.$on('$viewContentLoaded', function () {
        $scope.listBooks();
      });

      $scope.borrowCopy = function (copy) {
        var currentUser = window.sessionStorage.email;

        LoanService.
          borrowCopy(copy.id, currentUser).
          success(function () {
            BookService.getCopy(copy.id)
              .success(function (data) {
                var scope = angular.element('#copy-'.concat(copy.id)).scope();
                scope.copy = data;
                scope.copy.imageUrl = BookService.resolveBookImage(scope.copy.imageUrl);

                scope.copy.lastLoan.user = {
                  imageUrl: UserService.getGravatarFromUserEmail(scope.copy.lastLoan.email)
                };
              });
              toastr.success('Book has been loaned to '.concat(currentUser).concat('.'));
          }).
          error(function (data, status) {
            var errorMessage;

            switch (status) {
              case 412:
                errorMessage = $translate.instant('HTTP_CODE_412');
                break;
              case 409:
                errorMessage = $translate.instant('HTTP_CODE_409');
                break;
              default:
                errorMessage = $translate.instant('HTTP_CODE_500');
                break;
            }
            toastr.error(errorMessage);
          });
      };

      $scope.returnCopy = function (copy) {
        var scope = angular.element('#modal-div').scope();
        scope.loan = copy.lastLoan;

        var promise = Modal.open(
          'not-available', {loan : copy.lastLoan}
        );

        promise.then(
          function handleResolve(response) {
            LoanService.
              returnCopy(response.loan.id).
              success(function () {
                Modal.reject();

                toastr.success('Book has returned to library.');

                BookService.getCopy(copy.id)
                  .success(function (data) {
                    var scope = angular.element('#copy-'.concat(copy.id)).scope();
                    scope.copy = data;
                    scope.copy.imageUrl = BookService.resolveBookImage(scope.copy.imageUrl);

                  });
              }).
              error(function (data, status) {
                var errorMessage;

                switch (status) {
                  case 428:
                    errorMessage = $translate.instant('HTTP_CODE_428');
                    break;
                  default:
                    errorMessage = $translate.instant('HTTP_CODE_500');
                    break;
                }

                toastr.error(errorMessage);
              });
          }
        );
      };

      $scope.gotoAllBooks = function () {
        window.location.assign('/#/library/' + getLibrarySlug());
      };

      $scope.gotoAddBook = function () {
        window.location.assign('/#/library/' + getLibrarySlug() + '/add_book');
      };

      $scope.gotoAddWish = function () {
        window.location.assign('/#/library/' + getLibrarySlug() + '/add_wish');
      };

      $scope.gotoSettings = function () {
        window.location.assign('/#/library/' + getLibrarySlug() + '/settings');
      };

      function getLibrarySlug() {
        return $route.current.pathParams.library;
      }

      if (isInBookDetails) {
        $scope.reloadBookDetails($routeParams.bookId);
      }
    }]
);
