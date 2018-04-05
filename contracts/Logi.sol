pragma solidity ^0.4.21;

/**
 * @title ERC20 Token Interface
 * @dev See https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20.md.
 */
contract ERC20 {
    uint256 public totalSupply;
    function balanceOf(address who) public constant returns (uint256);
    function transfer(address to, uint256 value) public returns (bool);
    function allowance(address owner, address spender) public constant returns (uint256);
    function transferFrom(address from, address to, uint256 value) public returns (bool);
    function approve(address spender, uint256 value) public returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

/**
 * @title ERC677 transferAndCall token interface
 * @dev See https://github.com/ethereum/EIPs/issues/677 for specification and discussion.
 */
contract ERC677 {
    function transferAndCall(address _to, uint _value, bytes _data) public returns (bool success);
    event Transfer(address indexed _from, address indexed _to, uint256 _value, bytes _data);
}

/**
 * @title Receiver interface for ERC677 transferAndCall
 * @dev See https://github.com/ethereum/EIPs/issues/677 for specification and discussion.
 */
contract ERC677Receiver {
    function tokenFallback(address _from, uint _value, bytes _data) public;
}

contract LogiToken is ERC20, ERC677 {

    /** State Variables ***************************************************************/

    mapping(address => uint256) balances;
    mapping(address => uint256) lockups;
    mapping(address => mapping(address => uint256)) internal allowed;
    address constant none = address(0x0);
    
    string public constant name = "LOGI";
    string public constant symbol = "LOGI";
    uint8 public constant decimals = 18;
    uint256 public constant maxSupply = 100 * 1000 * 1000 * 10**uint256(decimals); // use the smallest denomination unit to operate with token amounts
    bool public mintingDone = false;
    address public owner;

    /** Owning ************************************************************************/

    /**
     * @dev The Logi constructor sets the original `owner` of the contract to the sender account.
     */
    function LogiToken() public {
        owner = msg.sender;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    /**
     * @dev Allows the current owner to transfer control of the contract to a newOwner.
     * @param _newOwner The address to transfer ownership to.
     */
    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0));
        owner = _newOwner;
    }

    /** Minting & Locking ************************************************************/  

    modifier mintingInProgress() {
        require(mintingDone == false);
        _;
    }

    modifier mintingFinished() {
        require(mintingDone == true);
        _;
    }

    /**
     * @notice Initializes participant balances with corresponding token amounts.
     * @dev Sizes of `_investors` and `_amounts` must be the same.
     * @param _investors Array of participant addressess
     * @param _amounts Array of token amounts (in the smallest denomination unit)
     */
    function mint(address[] _investors, uint256[] _amounts) public mintingInProgress onlyOwner {
        require(_investors.length == _amounts.length);

        for (uint i = 0; i < _investors.length; i++) {
            address investor = _investors[i];
            uint256 amount = _amounts[i];

            // check amount and hard cap
            require(amount >= 0);
            require(totalSupply + amount <= maxSupply);

            balances[investor] += amount;
            totalSupply += amount;

            // check overvlows/underflows
            assert(balances[investor] >= balances[investor] - amount);            
            assert(totalSupply >= totalSupply - amount);

            emit Transfer(msg.sender, investor, amount);
        }
    }

    /**
     * @notice Locks participant balances for any action with corresponding amount of time.
     * @dev Sizes of `_investors` and `_lockups` must be the same.
     * @param _investors Array of participants addressess
     * @param _lockups Array of timeouts (in seconds)
     */
    function lock(address[] _investors, uint256[] _lockups) public mintingInProgress onlyOwner {
        require(_investors.length == _lockups.length);

        for (uint i = 0; i < _investors.length; i++) {
            address investor = _investors[i]; 
            uint256 lockup = _lockups[i];

            // TODO: any checks here? I.e. for any MAX lock-up?

            lockups[investor] = lockup;

            // TODO: do we need to emit event here?
        }
    }

    /**
     * @notice Finishes minting process.
     */
    function finishMinting() public mintingInProgress onlyOwner {
        assert(totalSupply <= maxSupply); // ensure hard cap
        mintingDone = true;
    }

    /** ERC20 ***********************************************************************/

    /**
     * @notice Returns the account balance of another account with address `_owner`.
     * @param _owner The address to return balance of
     */
    function balanceOf(address _owner) public view returns (uint256) {
        return balances[_owner];
    }

    /**
     * @notice Transfers `_value` amount of tokens to address `_to`.
     * @param _to The receiver address
     * @param _value The amount of tokens to be transferred (in the smallest denomination unit)
     */
    function transfer(address _to, uint256 _value) public mintingFinished returns (bool) {
        // prevent some common errors
        require(_to != none);
        require(_to != address(this));

        // check lockups
        require(lockups[msg.sender] == 0 || now >= lockups[msg.sender]);

        // check balance
        require(balances[msg.sender] >= _value);

        // transfer
        balances[msg.sender] -= _value;
        balances[_to] += _value;

        // check overflows/underflows
        assert(balances[_to] >= balances[_to] - _value);

        emit Transfer(msg.sender, _to, _value);

        return true;
    }

    function transferFrom(address _from, address _to, uint256 _value) public mintingFinished returns (bool) {
        // prevent some common errors
        require(_to != none);
        require(_to != address(this));

        // check lockups
        require(lockups[msg.sender] == 0 || now >= lockups[msg.sender]);

        // check balance and allowance
        require(allowed[_from][msg.sender] >= _value);
        require(balances[_from] >= _value);

        allowed[_from][msg.sender] -= _value;
        balances[_from] -= _value;
        balances[_to] += _value;

        // check overflows/underflows
        assert(balances[_to] >= balances[_to] - _value);

        emit Transfer(_from, _to, _value);

        return true;
    }

    /**
     * @notice Approves the passed address to spend the specified amount of tokens on behalf of `msg.sender`.
     * @dev According to standard there is no additional checks in this method.
     *      See https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20.md#approve for details of possible attack.
     * @param _spender The address which will spend the funds.
     * @param _value The amount of tokens to be spent (in the smallest denomination unit).
     */
    function approve(address _spender, uint256 _value) public returns (bool) {
        allowed[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    /**
     * @notice Returns the amount of tokens that an `_owner` allowed to a `_spender`.
     * @param _owner address The address which owns the funds
     * @param _spender address The address which will spend the funds
     * @return A uint256 specifying the amount of tokens (in the smallest denomination unit) still available for the spender.
     */
    function allowance(address _owner, address _spender) public view returns (uint256) {
        return allowed[_owner][_spender];
    }
}