let app = angular.module("contactApp", ["ngRoute", "ui.bootstrap"]);

app.config(function ($routeProvider) {
  $routeProvider
    .when("/sign-in", {
      templateUrl: "sign-in.html",
      controller: "SignInController",
    })
    .when("/sign-up", {
      templateUrl: "sign-up.html",
      controller: "SignUpController",
    })
    .when("/contact-list", {
      templateUrl: "contact-list.html",
      controller: "ContactListController",
      resolve: {
        loginCheck: function (AuthService) {
          return AuthService.requireLogin();
        },
      },
      authenticate: true,
    })
    .when("/add-edit-contact", {
      templateUrl: "add-edit-contact.html",
      controller: "AddEditContactController",
      resolve: {
        loginCheck: function (AuthService) {
          return AuthService.requireLogin();
        },
      },
      authenticate: true,
    })
    .otherwise({ redirectTo: "/sign-in" });
});

app.run(function ($rootScope, $location, AuthService, UserService) {
  AuthService.isLoggedIn();

  if (AuthService.isLoggedIn()) {
    let loggedInUserEmail = localStorage.getItem("loggedInUserEmail");
    if (loggedInUserEmail) {
      UserService.setCurrentUser(loggedInUserEmail);
    }
  }

  $rootScope.$on("$routeChangeStart", function (event, next) {
    if (
      next.$$route &&
      next.$$route.authenticate &&
      !AuthService.isLoggedIn()
    ) {
      event.preventDefault();
      $location.path("/sign-in");
    }
    if (
      next.$$route &&
      next.$$route.originalPath === "/sign-in" &&
      AuthService.isLoggedIn()
    ) {
      event.preventDefault();
      $location.path("/contact-list");
    }

    if (AuthService.isLoggedIn()) {
      UserService.setCurrentUserContacts();
    }
  });
});

app.controller(
  "SignInController",
  function ($scope, $location, UserService, AuthService) {
    $scope.signInData = {};
    $scope.error = "";

    $scope.signIn = function () {
      let foundUser = UserService.signIn(
        $scope.signInData.email,
        $scope.signInData.password
      );
      if (foundUser) {
        $location.path("/contact-list");
      } else {
        $scope.error = "Invalid email or password. Please try again.";
      }
    };

    $scope.goToSignUp = function () {
      $location.path("/sign-up");
    };
  }
);

app.controller("SignUpController", function ($scope, $location, UserService) {
  $scope.signUpData = {};
  $scope.error = "";
  $scope.passwordsMatchError = false;

  $scope.signUp = function () {
    if (!$scope.signUpData.email || !$scope.signUpData.password) {
      $scope.error = "Email and password are required.";
      return;
    }

    if ($scope.signUpData.password !== $scope.signUpData.confirmPassword) {
      $scope.passwordsMatchError = true;
      return;
    }

    let success = UserService.signUp(
      $scope.signUpData.email,
      $scope.signUpData.password
    );
    if (success) {
      $location.path("/sign-in");
    } else {
      $scope.error = "Email already exists. Please choose a different email.";
    }
  };

  $scope.goToSignIn = function () {
    $location.path("/sign-in");
  };
});

app.controller(
  "ContactModalController",
  function ($scope, $uibModalInstance, UserService, contact) {
    $scope.contact = angular.copy(contact);

    $scope.saveContact = function () {
      UserService.saveContact($scope.contact, true);
      $uibModalInstance.close("saved");
    };

    $scope.deleteContact = function () {
      UserService.deleteContact($scope.contact);
      $uibModalInstance.close("deleted");
    };

    $scope.cancel = function () {
      $uibModalInstance.dismiss("cancel");
    };
  }
);

// ContactListController
app.controller(
  "ContactListController",
  function (
    $scope,
    $location,
    UserService,
    AuthService,
    $uibModal,
    $rootScope
  ) {
    $scope.contacts = UserService.getCurrentUserContacts();
    let modalInstance;

    $rootScope.$on("$routeChangeSuccess", function () {
      $scope.contacts = UserService.getCurrentUserContacts();
    });

    // Open edit mode for the selected contact
    $scope.editContact = function (contact) {
      UserService.setCurrentContact(contact);
      localStorage.setItem("editContactId", contact.id); // Set the editContactId in localStorage
      $location.path("/add-edit-contact").search({ id: contact.id }); // Pass contact ID as query parameter
      $scope.closeModal();
    };

    // Open add new contact mode
    $scope.addNewContact = function () {
      localStorage.removeItem("editContactId"); // Clear editContactId from localStorage
      $location.path("/add-edit-contact");
      $scope.closeModal();
    };

    $scope.closeModal = function () {
      if (modalInstance) {
        modalInstance.dismiss('cancel');
      }
    };

    $scope.logOut = function () {
      AuthService.logOut();
      $location.path("/sign-in");
      $scope.closeModal();
    };
  }
);


// AddEditContactController
app.controller(
  "AddEditContactController",
  function ($scope, $location, UserService, AuthService, $uibModal) {
    // Initialize contact as empty object
    $scope.contact = {};

    // Check if there's an ID in the query params or localStorage indicating an edit mode
    var editContactId = $location.search().id || localStorage.getItem("editContactId");

    // If editContactId is present, load the contact details
    if (editContactId) {
      var contactToEdit = UserService.getCurrentUserContacts().find(function(contact) {
        return contact.id === editContactId;
      });
      if (contactToEdit) {
        $scope.contact = angular.copy(contactToEdit);
      } else {
        // If the contact with the given ID is not found, redirect to contact list
        $location.path("/contact-list");
      }
    }

    // Function to save or add a new contact
    $scope.saveContact = function () {
      var editing = !!$scope.contact.id; // Check if contact has an ID (editing mode)
      UserService.saveContact($scope.contact, editing);
      $location.path("/contact-list");
      $scope.closeModal();
    };

    // Function to handle cancel button click
    $scope.cancel = function () {
      $location.path("/contact-list");
      $scope.closeModal();
    };

    // Function to handle image selection
    $scope.setImage = function (element) {
      let reader = new FileReader();
      reader.onload = function (e) {
        $scope.$apply(function () {
          $scope.contact.image = e.target.result;
        });
      };
      reader.readAsDataURL(element.files[0]);
    };

    // Function to close modal
    $scope.closeModal = function () {
      if ($scope.$resolve.$uibModalInstance) {
        $scope.$resolve.$uibModalInstance.dismiss("cancel");
      }
    };

    // Reset the contact object when navigating to the add new contact page
    if (!$location.search().id) {
      $scope.contact = {};
    }
  }
);

app.service("UserService", function (AuthService) {
  let users = JSON.parse(localStorage.getItem("users")) || [];
  let currentUser = JSON.parse(localStorage.getItem("currentUser")) || null;
  let currentContact =
    JSON.parse(localStorage.getItem("currentContact")) || null;

  function saveUsers() {
    localStorage.setItem("users", JSON.stringify(users));
  }

  function getUserByEmail(email) {
    return users.find((user) => user.email === email);
  }

  return {
    signIn: function (email, password) {
      let user = getUserByEmail(email);
      if (user && user.password === password) {
        currentUser = user;
        AuthService.logIn();
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        return true;
      }
      return false;
    },

    signUp: function (email, password) {
      if (getUserByEmail(email)) {
        return false;
      }
      users.push({ email: email, password: password, contacts: [] });
      saveUsers();
      return true;
    },

    getCurrentUserContacts: function () {
      return currentUser ? currentUser.contacts : [];
    },

    saveContact: function (contact, editing) {
      if (!currentUser) return;
    
      if (!editing) {
        contact.id = Date.now().toString();
      }
    
      let existingContactIndex = currentUser.contacts.findIndex(
        (c) => c.id === contact.id
      );
    
      if (existingContactIndex === -1) {
        currentUser.contacts.push(contact);
      } else {
        currentUser.contacts[existingContactIndex] = contact;
      }
    
      saveUsers();
    },

    deleteContact: function (contact) {
      if (!currentUser) return;

      let index = currentUser.contacts.indexOf(contact);
      if (index !== -1) {
        currentUser.contacts.splice(index, 1);
        saveUsers();
      }
    },

    setCurrentContact: function (contact) {
      currentContact = contact;
      localStorage.setItem("currentContact", JSON.stringify(currentContact));
    },

    getCurrentContact: function () {
      return currentContact;
    },

    clearCurrentContact: function () {
      currentContact = null;
      localStorage.removeItem("currentContact");
    },

    setCurrentUser: function (email) {
      currentUser = getUserByEmail(email);
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
    },

    setCurrentUserContacts: function () {
      if (currentUser) {
        currentUser = getUserByEmail(currentUser.email);
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
      }
    },
  };
});

app.service("AuthService", function ($rootScope, $location) {
  let loggedIn = localStorage.getItem("loggedIn") === "true";

  return {
    isLoggedIn: function () {
      loggedIn = localStorage.getItem("loggedIn") === "true";
      return loggedIn;
    },
    logIn: function () {
      loggedIn = true;
      localStorage.setItem("loggedIn", "true");
    },
    logOut: function () {
      loggedIn = false;
      localStorage.setItem("loggedIn", "false");
      $rootScope.$broadcast("logout");
    },
    requireLogin: function () {
      if (!loggedIn) {
        $location.path("/sign-in");
      }
    },
  };
});

app.directive("contactCard", function () {
  return {
    restrict: "EA",
    templateUrl: "contact-card.html",
    scope: {
      contact: "=",
    },
    link: function (scope, element) {
      element.on("dblclick", function () {
        scope.$apply(function () {
          scope.openModal(scope.contact);
        });
      });
    },
  };
});
