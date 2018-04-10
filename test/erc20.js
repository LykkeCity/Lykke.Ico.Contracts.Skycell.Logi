var _helpers = require('./helpers');

var expect = require('chai').use(require('chai-bignumber')(web3.BigNumber)).expect;

var Logi = artifacts.require('Logi');

contract('Logi', function(accounts) {

    var creditIsMinting = false;
    var initialSupply = creditIsMinting ? tokens(0) : tokens(100);
    var initialBalances = [
        [accounts[0], initialSupply]
    ];
    var initialAllowances = [];
    var alice = accounts[1];
    var bob = accounts[2];
    var charles = accounts[3];
    var contract = null;

    async function credit(to, amount) {
        if (creditIsMinting) {
            return await contract.generateTokens(to, amount, { from: accounts[0] });
        } else {
            return await contract.transfer(to, amount, { from: accounts[0] });
        }
    };

    function tokens(amount) {
        return new web3.BigNumber(amount).shift(18);
    };

    function when(name) {
        return 'when (' + name + ')';
    }

    beforeEach(async function() {
        contract = await Logi.new();

        // transfers must be enables for tests
        if (creditIsMinting) {
            await contract.enableTransfers(true, { from: accounts[0] });
        } else {
            await contract.generateTokens(accounts[0], initialSupply, { from: accounts[0] });
            await contract.finishMinting({ from: accounts[0] });
        }
    });

    describe('ERC-20', function() {
        describe('totalSupply()', function() {
            it('should have initial supply of ' + initialSupply.toFormat(), async function() {
                expect((await contract.totalSupply.call())).to.be.bignumber.equal(initialSupply);
            });

            it('should return the correct supply', async function() {
                await credit(alice, tokens(1));
                expect((await contract.totalSupply.call())).to.be.bignumber.equal(creditIsMinting ? initialSupply.plus(tokens(1)) : initialSupply);

                await credit(alice, tokens(2));
                expect((await contract.totalSupply.call())).to.be.bignumber.equal(creditIsMinting ? initialSupply.plus(tokens(3)) : initialSupply);

                await credit(bob, tokens(3));
                expect((await contract.totalSupply.call())).to.be.bignumber.equal(creditIsMinting ? initialSupply.plus(tokens(6)) : initialSupply);
            });
        });

        describe('balanceOf(_owner)', function() {
            it('should have correct initial balances', async function() {
                for (var i = 0; i < initialBalances.length; i++) {
                    var address = initialBalances[i][0];
                    var balance = initialBalances[i][1];
                    expect((await contract.balanceOf.call(address))).to.be.bignumber.equal(balance);
                }
            });

            it('should return the correct balances', async function() {
                await credit(alice, tokens(1));
                expect((await contract.balanceOf.call(alice))).to.be.bignumber.equal(tokens(1));

                await credit(alice, tokens(2));
                expect((await contract.balanceOf.call(alice))).to.be.bignumber.equal(tokens(3));

                await credit(bob, tokens(3));
                expect((await contract.balanceOf.call(bob))).to.be.bignumber.equal(tokens(3));
            });
        });

        describe('allowance(_owner, _spender)', function() {
            describeIt(when('_owner != _spender'), alice, bob);
            describeIt(when('_owner == _spender'), alice, alice);

            it('should have correct initial allowance', async function() {
                for (var i = 0; i < initialAllowances.length; i++) {
                    var owner = initialAllowances[i][0];
                    var spender = initialAllowances[i][1];
                    var expectedAllowance = initialAllowances[i][2];
                    expect((await contract.allowance.call(owner, spender))).to.be.bignumber.equal(expectedAllowance);
                }
            });

            it('should return the correct allowance', async function() {
                await contract.approve(bob, tokens(1), { from: alice });
                await contract.approve(charles, tokens(2), { from: alice });
                await contract.approve(charles, tokens(3), { from: bob });
                await contract.approve(alice, tokens(4), { from: bob });
                await contract.approve(alice, tokens(5), { from: charles });
                await contract.approve(bob, tokens(6), { from: charles });

                expect((await contract.allowance.call(alice, bob))).to.be.bignumber.equal(tokens(1));
                expect((await contract.allowance.call(alice, charles))).to.be.bignumber.equal(tokens(2));
                expect((await contract.allowance.call(bob, charles))).to.be.bignumber.equal(tokens(3));
                expect((await contract.allowance.call(bob, alice))).to.be.bignumber.equal(tokens(4));
                expect((await contract.allowance.call(charles, alice))).to.be.bignumber.equal(tokens(5));
                expect((await contract.allowance.call(charles, bob))).to.be.bignumber.equal(tokens(6));
            });

            function describeIt(name, from, to) {
                describe(name, function() {
                    it('should return the correct allowance', async function() {
                        await contract.approve(to, tokens(1), { from: from });
                        expect((await contract.allowance.call(from, to))).to.be.bignumber.equal(tokens(1));
                    });
                });
            }
        });

        describe('approve(_spender, _value)', function() {
            describeIt(when('_spender != sender'), alice, bob);
            describeIt(when('_spender == sender'), alice, alice);

            function describeIt(name, from, to) {
                describe(name, function() {
                    it('should return true when approving 0', async function() {
                        assert.isTrue((await contract.approve.call(to, tokens(0), { from: from })));
                    });

                    it('should return true when approving', async function() {
                        assert.isTrue((await contract.approve.call(to, tokens(3), { from: from })));
                    });

                    it('should return true when revoking approval', async function() {
                        await contract.approve(to, tokens(3), { from: from });
                        assert.isTrue((await contract.approve.call(to, tokens(0), { from: from })));
                    });

                    it('should return false when updating approving without "zero step"', async function() {
                        await contract.approve(to, tokens(2), { from: from });
                        await (0, _helpers.expectRevertOrFail)(contract.approve(to, tokens(2), { from: from }));
                    });

                    it('should update allowance accordingly', async function() {
                        await contract.approve(to, tokens(1), { from: from });
                        expect((await contract.allowance.call(from, to))).to.be.bignumber.equal(tokens(1));

                        await contract.approve(to, tokens(0), { from: from });
                        expect((await contract.allowance.call(from, to))).to.be.bignumber.equal(tokens(0));

                        await contract.approve(to, tokens(3), { from: from });
                        expect((await contract.allowance.call(from, to))).to.be.bignumber.equal(tokens(3));
                    });

                    it('should fire Approval event', async function() {
                        await testApprovalEvent(from, to, tokens(1));
                        if (from != to) {
                            await testApprovalEvent(to, from, tokens(2));
                        }
                    });

                    it('should fire Approval when allowance was set to 0', async function() {
                        await contract.approve(to, tokens(3), { from: from });
                        await testApprovalEvent(from, to, 0);
                    });

                    it('should fire Approval even when allowance did not change', async function() {
                        // even 0 -> 0 should fire Approval event
                        await testApprovalEvent(from, to, 0);

                        await contract.approve(to, tokens(3), { from: from });
                        await testApprovalEvent(from, to, tokens(3));
                    });
                });
            }

            async function testApprovalEvent(from, to, amount) {
                var result = await contract.approve(to, amount, { from: from });
                var log = result.logs[0];
                assert.equal(log.event, 'Approval');
                assert.equal(log.args.owner, from);
                assert.equal(log.args.spender, to);
                expect(log.args.value).to.be.bignumber.equal(amount);
            }
        });

        describe('transfer(_to, _value)', function() {
            describeIt(when('_to != sender'), alice, bob);
            describeIt(when('_to == sender'), alice, alice);

            function describeIt(name, from, to) {
                describe(name, function() {
                    it('should return true when called with amount of 0', async function() {
                        assert.isTrue((await contract.transfer.call(to, 0, { from: from })));
                    });

                    it('should return true when transfer can be made, false otherwise', async function() {
                        await credit(from, tokens(3));
                        assert.isTrue((await contract.transfer.call(to, tokens(1), { from: from })));
                        assert.isTrue((await contract.transfer.call(to, tokens(2), { from: from })));
                        assert.isTrue((await contract.transfer.call(to, tokens(3), { from: from })));

                        await contract.transfer(to, tokens(1), { from: from });
                        assert.isTrue((await contract.transfer.call(to, tokens(1), { from: from })));
                        assert.isTrue((await contract.transfer.call(to, tokens(2), { from: from })));
                    });

                    it('should revert when trying to transfer something while having nothing', async function() {
                        await (0, _helpers.expectRevertOrFail)(contract.transfer(to, tokens(1), { from: from }));
                    });

                    it('should revert when trying to transfer more than balance', async function() {
                        await credit(from, tokens(3));
                        await (0, _helpers.expectRevertOrFail)(contract.transfer(to, tokens(4), { from: from }));

                        await contract.transfer('0x1', tokens(1), { from: from });
                        await (0, _helpers.expectRevertOrFail)(contract.transfer(to, tokens(3), { from: from }));
                    });

                    it('should not affect totalSupply', async function() {
                        await credit(from, tokens(3));
                        var supply1 = await contract.totalSupply.call();
                        await contract.transfer(to, tokens(3), { from: from });
                        var supply2 = await contract.totalSupply.call();
                        expect(supply2).to.be.be.bignumber.equal(supply1);
                    });

                    it('should update balances accordingly', async function() {
                        await credit(from, tokens(3));
                        var fromBalance1 = await contract.balanceOf.call(from);
                        var toBalance1 = await contract.balanceOf.call(to);

                        await contract.transfer(to, tokens(1), { from: from });
                        var fromBalance2 = await contract.balanceOf.call(from);
                        var toBalance2 = await contract.balanceOf.call(to);

                        if (from == to) {
                            expect(fromBalance2).to.be.bignumber.equal(fromBalance1);
                        } else {
                            expect(fromBalance2).to.be.bignumber.equal(fromBalance1.minus(tokens(1)));
                            expect(toBalance2).to.be.bignumber.equal(toBalance1.plus(tokens(1)));
                        }

                        await contract.transfer(to, tokens(2), { from: from });
                        var fromBalance3 = await contract.balanceOf.call(from);
                        var toBalance3 = await contract.balanceOf.call(to);

                        if (from == to) {
                            expect(fromBalance3).to.be.bignumber.equal(fromBalance2);
                        } else {
                            expect(fromBalance3).to.be.bignumber.equal(fromBalance2.minus(tokens(2)));
                            expect(toBalance3).to.be.bignumber.equal(toBalance2.plus(tokens(2)));
                        }
                    });

                    it('should fire Transfer event', async function() {
                        await testTransferEvent(from, to, tokens(3));
                    });

                    it('should fire Transfer event when transferring amount of 0', async function() {
                        await testTransferEvent(from, to, 0);
                    });
                });
            }

            async function testTransferEvent(from, to, amount) {
                if (amount > 0) {
                    await credit(from, amount);
                }

                var result = await contract.transfer(to, amount, { from: from });
                var log = result.logs[0];
                assert.equal(log.event, 'Transfer');
                assert.equal(log.args.from, from);
                assert.equal(log.args.to, to);
                expect(log.args.value).to.be.bignumber.equal(amount);
            }
        });

        describe('transferFrom(_from, _to, _value)', function() {
            describeIt(when('_from != _to and _to != sender'), alice, bob, charles);
            describeIt(when('_from != _to and _to == sender'), alice, bob, bob);
            describeIt(when('_from == _to and _to != sender'), alice, alice, bob);
            describeIt(when('_from == _to and _to == sender'), alice, alice, alice);

            it('should revert when trying to transfer while not allowed at all', async function() {
                await credit(alice, tokens(3));
                await (0, _helpers.expectRevertOrFail)(contract.transferFrom(alice, bob, tokens(1), { from: bob }));
                await (0, _helpers.expectRevertOrFail)(contract.transferFrom(alice, charles, tokens(1), { from: bob }));
            });

            it('should fire Transfer event when transferring amount of 0 and sender is not approved', async function() {
                await testTransferEvent(alice, bob, bob, 0);
            });

            function describeIt(name, from, via, to) {
                describe(name, function() {
                    beforeEach(async function() {
                        // by default approve sender (via) to transfer
                        await contract.approve(via, tokens(3), { from: from });
                    });

                    it('should return true when called with amount of 0 and sender is approved', async function() {
                        assert.isTrue((await contract.transferFrom.call(from, to, 0, { from: via })));
                    });

                    it('should return true when called with amount of 0 and sender is not approved', async function() {
                        assert.isTrue((await contract.transferFrom.call(to, from, 0, { from: via })));
                    });

                    it('should return true when transfer can be made, false otherwise', async function() {
                        await credit(from, tokens(3));
                        assert.isTrue((await contract.transferFrom.call(from, to, tokens(1), { from: via })));
                        assert.isTrue((await contract.transferFrom.call(from, to, tokens(2), { from: via })));
                        assert.isTrue((await contract.transferFrom.call(from, to, tokens(3), { from: via })));

                        await contract.transferFrom(from, to, tokens(1), { from: via });
                        assert.isTrue((await contract.transferFrom.call(from, to, tokens(1), { from: via })));
                        assert.isTrue((await contract.transferFrom.call(from, to, tokens(2), { from: via })));
                    });

                    it('should revert when trying to transfer something while _from having nothing', async function() {
                        await (0, _helpers.expectRevertOrFail)(contract.transferFrom(from, to, tokens(1), { from: via }));
                    });

                    it('should revert when trying to transfer more than balance of _from', async function() {
                        await credit(from, tokens(2));
                        await (0, _helpers.expectRevertOrFail)(contract.transferFrom(from, to, tokens(3), { from: via }));
                    });

                    it('should revert when trying to transfer more than allowed', async function() {
                        await credit(from, tokens(4));
                        await (0, _helpers.expectRevertOrFail)(contract.transferFrom(from, to, tokens(4), { from: via }));
                    });

                    it('should not affect totalSupply', async function() {
                        await credit(from, tokens(3));
                        var supply1 = await contract.totalSupply.call();
                        await contract.transferFrom(from, to, tokens(3), { from: via });
                        var supply2 = await contract.totalSupply.call();
                        expect(supply2).to.be.be.bignumber.equal(supply1);
                    });

                    it('should update balances accordingly', async function() {
                        await credit(from, tokens(3));
                        var fromBalance1 = await contract.balanceOf.call(from);
                        var viaBalance1 = await contract.balanceOf.call(via);
                        var toBalance1 = await contract.balanceOf.call(to);

                        await contract.transferFrom(from, to, tokens(1), { from: via });
                        var fromBalance2 = await contract.balanceOf.call(from);
                        var viaBalance2 = await contract.balanceOf.call(via);
                        var toBalance2 = await contract.balanceOf.call(to);

                        if (from == to) {
                            expect(fromBalance2).to.be.bignumber.equal(fromBalance1);
                        } else {
                            expect(fromBalance2).to.be.bignumber.equal(fromBalance1.minus(tokens(1)));
                            expect(toBalance2).to.be.bignumber.equal(toBalance1.plus(tokens(1)));
                        }

                        if (via != from && via != to) {
                            expect(viaBalance2).to.be.bignumber.equal(viaBalance1);
                        }

                        await contract.transferFrom(from, to, tokens(2), { from: via });
                        var fromBalance3 = await contract.balanceOf.call(from);
                        var viaBalance3 = await contract.balanceOf.call(via);
                        var toBalance3 = await contract.balanceOf.call(to);

                        if (from == to) {
                            expect(fromBalance3).to.be.bignumber.equal(fromBalance2);
                        } else {
                            expect(fromBalance3).to.be.bignumber.equal(fromBalance2.minus(tokens(2)));
                            expect(toBalance3).to.be.bignumber.equal(toBalance2.plus(tokens(2)));
                        }

                        if (via != from && via != to) {
                            expect(viaBalance3).to.be.bignumber.equal(viaBalance2);
                        }
                    });

                    it('should update allowances accordingly', async function() {
                        await credit(from, tokens(3));
                        var viaAllowance1 = await contract.allowance.call(from, via);
                        var toAllowance1 = await contract.allowance.call(from, to);

                        await contract.transferFrom(from, to, tokens(2), { from: via });
                        var viaAllowance2 = await contract.allowance.call(from, via);
                        var toAllowance2 = await contract.allowance.call(from, to);

                        expect(viaAllowance2).to.be.bignumber.equal(viaAllowance1.minus(tokens(2)));

                        if (to != via) {
                            expect(toAllowance2).to.be.bignumber.equal(toAllowance1);
                        }

                        await contract.transferFrom(from, to, tokens(1), { from: via });
                        var viaAllowance3 = await contract.allowance.call(from, via);
                        var toAllowance3 = await contract.allowance.call(from, to);

                        expect(viaAllowance3).to.be.bignumber.equal(viaAllowance2.minus(tokens(1)));

                        if (to != via) {
                            expect(toAllowance3).to.be.bignumber.equal(toAllowance1);
                        }
                    });

                    it('should fire Transfer event', async function() {
                        await testTransferEvent(from, via, to, tokens(3));
                    });

                    it('should fire Transfer event when transferring amount of 0', async function() {
                        await testTransferEvent(from, via, to, 0);
                    });
                });
            }

            async function testTransferEvent(from, via, to, amount) {
                if (amount > 0) {
                    await credit(from, amount);
                }

                var result = await contract.transferFrom(from, to, amount, { from: via });
                var log = result.logs[0];
                assert.equal(log.event, 'Transfer');
                assert.equal(log.args.from, from);
                assert.equal(log.args.to, to);
                expect(log.args.value).to.be.bignumber.equal(amount);
            }
        });
    });
});

/**
* Formats the describe-case name.
* @param {string} name
*/
function when(name) {
    return 'when (' + name + ')';
}